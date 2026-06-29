<script lang="ts">
    import { onMount } from 'svelte';

    import { Progress } from '$lib/components/ui/progress/index.js';

    import { renderExportedVideo, stitchSegments } from '$lib/videoStitcher.js';
    import type { VideoEncodingQuality } from '$lib/types/quality';
 
    interface DeletedRange {
        startTime: number;
        endTime: number;
    }

    interface Props {
        quality?: VideoEncodingQuality
        segments?: Blob[];
        deletedRanges?: DeletedRange[];
        oncomplete: (blob: Blob) => void;
    }

    let { segments = [], quality = "high", deletedRanges = [], oncomplete }: Props = $props();

    let progress = $state(0);
    let status = $state('Preparing…');
    let errorMessage = $state<string | null>(null);

    onMount(() => {
        let cancelled = false;

        (async () => {
         
            try {
                // Everything runs natively (canvas + MediaRecorder) — no ffmpeg.
                // 1. Combine segments if needed (the Editor normally passes a single
                //    already-combined blob, so this is a safety net).
                let source = segments[0];
                if (segments.length > 1) {
                    status = 'Combining recordings…';
                    source = await stitchSegments(segments, quality, (f: number) => {
                        progress = Math.round(f * 100);
                    });
                    if (cancelled) return;
                }

                // 2. Apply cuts by re-rendering only the kept ranges.
                // if (deletedRanges.length > 0) {
                    status = 'Applying edits…';
                    progress = 0;
                    source = await renderExportedVideo(source, quality, deletedRanges, (f: number) => {
                        progress = Math.round(f * 100);
                    });
                    if (cancelled) return;

                // re-encode video t
            

                progress = 100;
                status = 'Done!';
                setTimeout(() => {
                    if (!cancelled) oncomplete(source);
                }, 300);
            } catch (err) {
                if (!cancelled) errorMessage = err instanceof Error ? err.message : String(err);
            }
        })();

        return () => {
            cancelled = true;
        };
    });
</script>

<div class="flex h-full flex-col items-center justify-center p-8">
    {#if errorMessage}
        <div class="w-full max-w-sm space-y-2 text-center">
            <p class="text-sm font-medium text-destructive">Export failed</p>
            <p class="font-mono text-xs break-all text-muted-foreground">{errorMessage}</p>
        </div>
    {:else}
        <div class="w-full max-w-sm space-y-3">
            <div class="flex items-baseline justify-between text-sm">
                <span class="text-muted-foreground">{status}</span>
                <span class="font-mono tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} class="*:bg-indigo-500" />
        </div>
    {/if}
</div>
