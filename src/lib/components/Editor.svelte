<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Play, Pause, ChevronLeft } from 'lucide-svelte';

    export interface CutRegion {
        id: string;
        start: number;
        end: number;
    }

    type DragTarget =
        | { type: 'playhead' }
        | { type: 'trimStart' }
        | { type: 'trimEnd' }
        | { type: 'cutLeft'; id: string }
        | { type: 'cutRight'; id: string };

    interface Props {
        onback: () => void;
        onexport: (trimStart: number, trimEnd: number, cuts: CutRegion[]) => void;
        videoUrl?: string | null;
    }

    let { onback, onexport, videoUrl = null }: Props = $props();

    let paused = $state(true);
    let currentTime = $state(0);
    let videoDuration = $state(0);
    let trimStart = $state(0);
    let trimEnd = $state(0);
    let cuts = $state<CutRegion[]>([]);
    let selectedCutId = $state<string | null>(null);
    let thumbnails = $state<string[]>([]);
    let thumbnailCount = $state(0);
    let thumbnailsLoading = $state(false);
    let thumbVideoEl: HTMLVideoElement | undefined;
    let _thumbGen = 0;
    let dragging = $state<DragTarget | null>(null);

    let timelineEl: HTMLDivElement | undefined;

    function attachTimeline(node: HTMLDivElement) {
        timelineEl = node;
        return () => {
            timelineEl = undefined;
        };
    }

    function attachThumbVideo(node: HTMLVideoElement) {
        thumbVideoEl = node;
        return () => {
            thumbVideoEl = undefined;
        };
    }

    async function startThumbnails(duration: number) {
        console.log('[Editor] 6. Starting thumbnail generation — duration:', duration, 'videoUrl present:', !!videoUrl);
        if (!videoUrl || !isFinite(duration) || !thumbVideoEl) return;
        const gen = ++_thumbGen;
        const count = Math.max(4, Math.min(24, Math.ceil(duration / 3)));
        thumbnailCount = count;
        thumbnailsLoading = true;
        thumbnails = [];
        const vid = thumbVideoEl;

        for (let i = 0; i < count; i++) {
            if (_thumbGen !== gen) return;
            const seekTime = count > 1 ? (i / (count - 1)) * duration : 0;
            console.log('[Editor] 7. Seeking to frame', i + 1, '/', count, 'at', seekTime.toFixed(2), 's');
            vid.currentTime = seekTime;
            await new Promise<void>(resolve => { vid.onseeked = () => resolve(); });
            if (_thumbGen !== gen) return;
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            canvas.getContext('2d')?.drawImage(vid, 0, 0, 160, 90);
            thumbnails = [...thumbnails, canvas.toDataURL('image/jpeg', 0.7)];
            console.log('[Editor] 8. Thumbnail captured:', thumbnails.length, '/', count);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (_thumbGen === gen) {
            thumbnailsLoading = false;
            thumbnailCount = thumbnails.length;
            console.log('[Editor] All thumbnails complete:', thumbnails.length);
        }
    }

    onMount(() => {
        console.log('[Editor] 1. Component mounting');
        console.log('[Editor] 2. videoUrl received:', videoUrl ? 'present (' + videoUrl.slice(0, 60) + '...)' : 'null');
        return () => {
            _thumbGen++; // cancel any in-progress thumbnail generation
        };
    });

    function formatTime(s: number): string {
        const m = Math.floor(s / 60)
            .toString()
            .padStart(2, '0');
        const sec = Math.floor(s % 60)
            .toString()
            .padStart(2, '0');
        return `${m}:${sec}`;
    }

    function timeToPercent(t: number): number {
        return videoDuration > 0 ? (t / videoDuration) * 100 : 0;
    }

    let finalLength = $derived.by(() => {
        const cutDur = cuts.reduce((sum, c) => {
            const s = Math.max(c.start, trimStart);
            const e = Math.min(c.end, trimEnd);
            return sum + Math.max(0, e - s);
        }, 0);
        return Math.max(0, trimEnd - trimStart - cutDur);
    });

    let timestamps = $derived.by(() => {
        if (!videoDuration || !isFinite(videoDuration)) return [];
        const step =
            videoDuration > 120 ? 60 : videoDuration > 60 ? 30 : videoDuration > 30 ? 15 : 10;
        const labels: { t: number; pct: number }[] = [];
        for (let t = 0; t <= videoDuration; t += step) {
            labels.push({ t, pct: (t / videoDuration) * 100 });
        }
        return labels;
    });

    function addCut() {
        if (!videoDuration) return;
        const half = Math.min(2, (trimEnd - trimStart) * 0.1);
        const start = Math.max(trimStart, currentTime - half);
        const end = Math.min(trimEnd, currentTime + half);
        if (end - start < 0.1) return;
        const id = crypto.randomUUID();
        cuts = [...cuts, { id, start, end }];
        selectedCutId = id;
    }

    function removeCut() {
        if (!selectedCutId) return;
        cuts = cuts.filter((c) => c.id !== selectedCutId);
        selectedCutId = null;
    }

    function seekToTime(e: MouseEvent | KeyboardEvent) {
        if (!timelineEl || !videoDuration) return;
        if (e instanceof KeyboardEvent) return;
        const rect = timelineEl.getBoundingClientRect();
        currentTime = Math.max(
            0,
            Math.min(videoDuration, ((e.clientX - rect.left) / rect.width) * videoDuration)
        );
    }

    function startDrag(target: DragTarget) {
        dragging = target;
    }

    function handleDragMove(e: PointerEvent) {
        const d = dragging;
        if (!d || !timelineEl || !videoDuration) return;
        const rect = timelineEl.getBoundingClientRect();
        const t = Math.max(
            0,
            Math.min(videoDuration, ((e.clientX - rect.left) / rect.width) * videoDuration)
        );
        if (d.type === 'playhead') {
            currentTime = t;
        } else if (d.type === 'trimStart') {
            trimStart = Math.min(t, trimEnd - 0.5);
        } else if (d.type === 'trimEnd') {
            trimEnd = Math.max(t, trimStart + 0.5);
        } else if (d.type === 'cutLeft') {
            cuts = cuts.map((c) => (c.id === d.id ? { ...c, start: Math.min(t, c.end - 0.5) } : c));
        } else if (d.type === 'cutRight') {
            cuts = cuts.map((c) => (c.id === d.id ? { ...c, end: Math.max(t, c.start + 0.5) } : c));
        }
    }

    function handleDragEnd() {
        dragging = null;
    }

    function handleKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.code === 'Space') {
            e.preventDefault();
            paused = !paused;
        } else if (e.code === 'ArrowLeft') {
            currentTime = Math.max(0, currentTime - 5);
        } else if (e.code === 'ArrowRight') {
            currentTime = Math.min(videoDuration, currentTime + 5);
        } else if (e.code === 'KeyC') {
            addCut();
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
            removeCut();
        } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyE') {
            e.preventDefault();
            onexport(trimStart, trimEnd, cuts);
        }
    }
</script>

<svelte:window onkeydown={handleKey} onpointermove={handleDragMove} onpointerup={handleDragEnd} />

<div class="flex h-full flex-col">
    <!-- Video -->
    <div class="relative min-h-0 flex-1 bg-black/20">
        {#if videoUrl}
            <video
                {@attach attachThumbVideo}
                src={videoUrl}
                muted
                preload="auto"
                class="hidden"
                aria-hidden="true"
            ></video>
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
                src={videoUrl}
                bind:paused
                bind:currentTime
                bind:duration={videoDuration}
                onloadedmetadata={() => {
                    console.log('[Editor] 5. Video metadata loaded — duration:', videoDuration, 'finite:', isFinite(videoDuration));
                    if (!isFinite(videoDuration)) return;
                    trimEnd = videoDuration;
                    startThumbnails(videoDuration);
                }}
                class="h-full w-full object-contain"
            ></video>
        {:else}
            <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
                No video loaded
            </div>
        {/if}
    </div>

    <!-- Player controls -->
    <div class="flex items-center gap-3 border-t px-4 py-2">
        <Button
            variant="ghost"
            size="icon"
            onclick={() => {
                paused = !paused;
            }}
        >
            {#if paused}
                <Play class="size-4" />
            {:else}
                <Pause class="size-4" />
            {/if}
        </Button>
        <span class="min-w-[90px] font-mono text-sm text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(videoDuration)}
        </span>
        <input
            type="range"
            class="flex-1 accent-foreground"
            min="0"
            max={videoDuration || 1}
            step="0.01"
            bind:value={currentTime}
        />
    </div>

    <!-- Timeline -->
    {#if videoDuration > 0}
        <div class="px-4 pt-2 pb-1">
            <div {@attach attachTimeline} class="relative h-16 overflow-hidden rounded-md bg-muted">
                <!-- Thumbnails and loading skeletons (visual only) -->
                {#if thumbnailCount > 0}
                    <div class="pointer-events-none absolute inset-0 flex">
                        {#each Array(thumbnailCount) as _, i (i)}
                            {@const dataUrl = thumbnails[i]}
                            {#if dataUrl}
                                <img
                                    src={dataUrl}
                                    alt=""
                                    class="h-full shrink-0 object-cover"
                                    style="width:{100 / thumbnailCount}%"
                                />
                            {:else}
                                <div
                                    class="h-full shrink-0 animate-pulse bg-muted-foreground/20"
                                    style="width:{100 / thumbnailCount}%"
                                ></div>
                            {/if}
                        {/each}
                    </div>
                {/if}

                <!-- Seek layer (below handles) -->
                <button
                    type="button"
                    aria-label="Seek to position"
                    class="absolute inset-0 z-10 cursor-crosshair"
                    onclick={seekToTime}
                ></button>

                <!-- Excluded overlays (outside trim) -->
                {#if trimStart > 0}
                    <div
                        class="pointer-events-none absolute inset-y-0 left-0 z-10 bg-black/60"
                        style="width:{timeToPercent(trimStart)}%"
                    ></div>
                {/if}
                {#if trimEnd < videoDuration}
                    <div
                        class="pointer-events-none absolute inset-y-0 right-0 z-10 bg-black/60"
                        style="width:{100 - timeToPercent(trimEnd)}%"
                    ></div>
                {/if}

                <!-- Cut regions (z-20) -->
                {#each cuts as cut (cut.id)}
                    {@const left = timeToPercent(cut.start)}
                    {@const w = timeToPercent(cut.end) - left}
                    <div
                        class="absolute inset-y-0 z-20 flex items-center justify-center bg-red-500/50 text-xs font-medium text-white{selectedCutId ===
                        cut.id
                            ? ' ring-2 ring-red-400 ring-inset'
                            : ''}"
                        style="left:{left}%;width:{w}%"
                        role="button"
                        tabindex="0"
                        onclick={(e) => {
                            e.stopPropagation();
                            selectedCutId = cut.id;
                        }}
                        onkeydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') selectedCutId = cut.id;
                        }}
                    >
                        <span class="pointer-events-none select-none">cut</span>
                        <div
                            class="absolute inset-y-0 left-0 z-30 w-2 cursor-ew-resize bg-red-400 hover:bg-red-300"
                            role="none"
                            onpointerdown={(e) => {
                                e.stopPropagation();
                                startDrag({ type: 'cutLeft', id: cut.id });
                            }}
                        ></div>
                        <div
                            class="absolute inset-y-0 right-0 z-30 w-2 cursor-ew-resize bg-red-400 hover:bg-red-300"
                            role="none"
                            onpointerdown={(e) => {
                                e.stopPropagation();
                                startDrag({ type: 'cutRight', id: cut.id });
                            }}
                        ></div>
                    </div>
                {/each}

                <!-- Trim handles (z-30) -->
                <div
                    class="absolute inset-y-0 z-30 w-1 -translate-x-1/2 cursor-ew-resize bg-white shadow"
                    style="left:{timeToPercent(trimStart)}%"
                    role="none"
                    onpointerdown={(e) => {
                        e.stopPropagation();
                        startDrag({ type: 'trimStart' });
                    }}
                ></div>
                <div
                    class="absolute inset-y-0 z-30 w-1 -translate-x-1/2 cursor-ew-resize bg-white shadow"
                    style="left:{timeToPercent(trimEnd)}%"
                    role="none"
                    onpointerdown={(e) => {
                        e.stopPropagation();
                        startDrag({ type: 'trimEnd' });
                    }}
                ></div>

                <!-- Playhead (z-40) -->
                <div
                    class="pointer-events-none absolute inset-y-0 z-40 w-0.5 bg-white/90"
                    style="left:{timeToPercent(currentTime)}%"
                >
                    <div
                        class="pointer-events-auto absolute top-0 -left-2 h-3 w-4 cursor-grab rounded-b-sm bg-white active:cursor-grabbing"
                        role="none"
                        onpointerdown={(e) => {
                            e.stopPropagation();
                            startDrag({ type: 'playhead' });
                        }}
                    ></div>
                </div>
            </div>

            <!-- Timestamps -->
            <div class="relative h-5 overflow-hidden text-xs text-muted-foreground">
                {#each timestamps as ts (ts.t)}
                    <span class="absolute -translate-x-1/2" style="left:{ts.pct}%"
                        >{formatTime(ts.t)}</span
                    >
                {/each}
            </div>
        </div>
    {/if}

    <!-- Cut controls -->
    <div class="flex items-center gap-2 border-t px-4 py-2">
        <Button variant="outline" size="sm" onclick={addCut}>Add Cut</Button>
        {#if selectedCutId}
            <Button variant="outline" size="sm" onclick={removeCut}>Remove Cut</Button>
        {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center border-t px-4 py-3">
        <Button variant="ghost" size="sm" onclick={onback}>
            <ChevronLeft class="mr-1 size-4" />
            Back to Review
        </Button>
        <div class="flex-1 text-center text-sm text-muted-foreground">
            Final: {formatTime(finalLength)}
        </div>
        <Button onclick={() => onexport(trimStart, trimEnd, cuts)}>Export & Download</Button>
    </div>
</div>
