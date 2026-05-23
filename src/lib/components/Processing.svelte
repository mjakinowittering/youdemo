<script lang="ts">
    import { onMount } from 'svelte';
    import { Progress } from '$lib/components/ui/progress/index.js';

    interface CutRegion {
        id: string;
        start: number;
        end: number;
    }

    interface Props {
        segments?: Blob[];
        trimStart?: number;
        trimEnd?: number;
        cuts?: CutRegion[];
        oncomplete: (blob: Blob) => void;
    }

    let { segments = [], trimStart = 0, trimEnd = 0, cuts = [], oncomplete }: Props = $props();

    let progress = $state(0);
    let errorMessage = $state<string | null>(null);

    let statusLabel = $derived(
        progress < 20
            ? 'Loading FFmpeg…'
            : progress < 40
              ? 'Stitching segments…'
              : progress < 80
                ? 'Applying edits…'
                : progress < 100
                  ? 'Encoding MP4…'
                  : 'Done!'
    );

    onMount(() => {
        console.log('[Processing] onMount — starting FFmpeg worker now (state is processing)');
        console.log('[Processing] segments:', segments.length, 'trimStart:', trimStart, 'trimEnd:', trimEnd, 'cuts:', cuts.length);
        const worker = new Worker(new URL('../ffmpegWorker.ts', import.meta.url), {
            type: 'module'
        });

        worker.onmessage = (e: MessageEvent) => {
            const { type } = e.data;
            if (type === 'progress') {
                progress = e.data.percent;
            } else if (type === 'complete') {
                progress = 100;
                worker.terminate();
                setTimeout(() => oncomplete(e.data.blob), 500);
            } else if (type === 'error') {
                console.error('[Processing] Worker reported error:', e.data.message);
                errorMessage = e.data.message;
                worker.terminate();
            }
        };

        worker.onerror = (e) => {
            console.error('[Processing] Worker uncaught error:', e);
            errorMessage = e.message ?? 'Unknown worker error';
            worker.terminate();
        };

        (async () => {
            const plainSegments: Blob[] = [];
            for (const s of segments) {
                const buffer = await s.arrayBuffer();
                plainSegments.push(new Blob([buffer], { type: 'video/webm' }));
            }
            console.log('[Processing] Plain segments ready:', plainSegments.length, plainSegments.map((s) => s.size));
            worker.postMessage({ segments: plainSegments, trimStart, trimEnd, cuts: cuts ?? [] });
        })();

        return () => worker.terminate();
    });
</script>

<div class="flex h-full flex-col items-center justify-center p-8">
    {#if errorMessage}
        <div class="w-full max-w-sm space-y-2 text-center">
            <p class="text-sm font-medium text-destructive">Export failed</p>
            <p class="font-mono text-xs text-muted-foreground break-all">{errorMessage}</p>
        </div>
    {:else}
        <div class="w-full max-w-sm space-y-3">
            <div class="flex items-baseline justify-between text-sm">
                <span class="text-muted-foreground">{statusLabel}</span>
                <span class="font-mono tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} />
        </div>
    {/if}
</div>
