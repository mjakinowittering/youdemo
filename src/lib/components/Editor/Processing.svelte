<script lang="ts">
    import { Film, TriangleAlert } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';
    import { Progress } from '$lib/components/ui/progress/index.js';

    import type { DeletedRange } from '$lib/types.js';
    import { renderEditedVideo, stitchSegments } from '$lib/videoStitcher.js';

    interface Props {
        segments?: Blob[];
        deletedRanges?: DeletedRange[];
        oncomplete: (blob: Blob) => void;
        progress?: number;
    }

    let {
        segments = [],
        deletedRanges = [],
        oncomplete,
        progress = $bindable(0)
    }: Props = $props();

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
                    source = await stitchSegments(segments, (f) => {
                        progress = Math.round(f * 100);
                    });
                    if (cancelled) return;
                }

                // 2. Apply cuts by re-rendering only the kept ranges.
                if (deletedRanges.length > 0) {
                    status = 'Applying edits…';
                    progress = 0;
                    source = await renderEditedVideo(source, deletedRanges, (f) => {
                        progress = Math.round(f * 100);
                    });
                    if (cancelled) return;
                }

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

<div class="flex h-full flex-col items-center justify-center bg-black/20">
    <Card.Root
        class="w-full max-w-xl items-center justify-center border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent"
    >
        <Empty.Root>
            {#if errorMessage}
                <Empty.Media>
                    <TriangleAlert size={128} class="text-destructive" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title>Export failed</Empty.Title>
                    <Empty.Description class="font-mono break-all">
                        {errorMessage}
                    </Empty.Description>
                </Empty.Header>
            {:else}
                <Empty.Media>
                    <Film size={128} class="text-muted-foreground" />
                </Empty.Media>
                <Empty.Header>
                    <Empty.Title>{status}</Empty.Title>
                    <Empty.Description>
                        Combining your recordings, ready for download.
                    </Empty.Description>
                </Empty.Header>
                <Empty.Content>
                    <div class="w-full max-w-sm space-y-2">
                        <Progress value={progress} class="*:bg-indigo-500" />
                        <p class="text-center font-mono text-sm text-muted-foreground tabular-nums">
                            {progress}%
                        </p>
                    </div>
                </Empty.Content>
            {/if}
        </Empty.Root>
    </Card.Root>
</div>
