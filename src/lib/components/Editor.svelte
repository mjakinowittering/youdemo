<script lang="ts">
    import { ChevronLeft, Pause, Play, Scissors, Trash2 } from 'lucide-svelte';
    import { onMount } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';

    import { Button } from '$lib/components/ui/button/index.js';

    export interface DeletedRange {
        startTime: number;
        endTime: number;
    }

    interface Props {
        onback: () => void;
        onexport: (deletedRanges: DeletedRange[], totalDuration: number) => void;
        videoUrl?: string | null;
    }

    let { onback, onexport, videoUrl = null }: Props = $props();

    const FRAME_RATE = 30;
    const SAMPLE_INTERVAL = 0.2;
    const CELL_WIDTH = 80;
    const CELL_HEIGHT = 64;
    const CELL_GAP = 3;
    const CELL_STRIDE = CELL_WIDTH + CELL_GAP;

    let videoEl = $state<HTMLVideoElement | undefined>(undefined);
    let scrollContainer = $state<HTMLDivElement | undefined>(undefined);

    let paused = $state(true);
    let currentTime = $state(0);
    let videoDuration = $state(0);

    let thumbnails = new SvelteMap<number, string>();
    let deletedRanges = $state<DeletedRange[]>([]);
    let editMode = $state(false);
    let anchorCell = $state<number | null>(null);
    let selectedCells = $state(new Set<number>());
    let collapsingCells = $state(new Set<number>());
    let scrollLeft = $state(0);
    let containerWidth = $state(0);
    let showPlayIcon = $state(false);
    let showPauseIcon = $state(false);

    let cellCount = $derived(Math.round(videoDuration / SAMPLE_INTERVAL));
    let currentCell = $derived(Math.round(currentTime / SAMPLE_INTERVAL));

    let deletedCells: Set<number> = $derived(
        new Set(
            Array.from({ length: cellCount }, (_, i) => i).filter((i) => {
                const t = i * SAMPLE_INTERVAL;
                return deletedRanges.some((r) => t >= r.startTime && t < r.endTime);
            })
        )
    );

    // Sequential list of non-deleted cell indices in original order
    let visibleCells: number[] = $derived(
        Array.from({ length: cellCount }, (_, i) => i).filter((i) => !deletedCells.has(i))
    );

    // Map from original cell index → rendered (sequential) position in the strip
    let cellRenderPos: Map<number, number> = $derived(
        new Map(visibleCells.map((idx, pos) => [idx, pos]))
    );

    // Virtualization over rendered positions
    let posStart = $derived(Math.max(0, Math.floor(scrollLeft / CELL_STRIDE) - 5));
    let posEnd = $derived(
        Math.min(
            visibleCells.length - 1,
            Math.ceil((scrollLeft + containerWidth) / CELL_STRIDE) + 5
        )
    );
    let totalStripWidth = $derived(visibleCells.length * CELL_STRIDE);
    let leftSpacerWidth = $derived(posStart * CELL_STRIDE);
    let currentCellPos = $derived(cellRenderPos.get(currentCell) ?? -1);

    let timestampLabels: { visibleIndex: number; label: string }[] = $derived(
        (() => {
            const interval = Math.max(1, Math.round(visibleCells.length / 8));
            return visibleCells
                .map((_, visibleIndex) => ({ visibleIndex }))
                .filter(({ visibleIndex }) => visibleIndex % interval === 0)
                .map(({ visibleIndex }) => ({
                    visibleIndex,
                    label: formatTime(visibleIndex * SAMPLE_INTERVAL)
                }));
        })()
    );

    let effectiveDuration = $derived(
        Math.max(
            0,
            videoDuration -
                deletedRanges.reduce((sum, r) => sum + Math.max(0, r.endTime - r.startTime), 0)
        )
    );

    let effectiveCurrentTime = $derived.by(() => {
        const t = currentTime;
        const deletedBefore = deletedRanges
            .filter((r) => r.endTime <= t)
            .reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
        return Math.max(0, t - deletedBefore);
    });

    $effect(() => {
        if (!scrollContainer || paused || currentCellPos < 0) return;
        const targetScrollLeft = currentCellPos * CELL_STRIDE - containerWidth / 2;
        scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
    });

    function handleCellClick(cellIndex: number) {
        if (!editMode) {
            safeSeek(cellIndex * SAMPLE_INTERVAL);
            return;
        }

        if (anchorCell === null) {
            anchorCell = cellIndex;
            selectedCells = new Set([cellIndex]);
        } else {
            const start = Math.min(anchorCell, cellIndex);
            const end = Math.max(anchorCell, cellIndex);
            selectedCells = new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i));
            anchorCell = null;
        }
    }

    async function deleteSelectedCells() {
        if (selectedCells.size === 0) return;

        collapsingCells = new Set(selectedCells);

        await new Promise<void>((resolve) => setTimeout(resolve, 250));

        const indices = Array.from(selectedCells).sort((a, b) => a - b);
        const startTime = indices[0] * SAMPLE_INTERVAL;
        const endTime = (indices[indices.length - 1] + 1) * SAMPLE_INTERVAL;
        deletedRanges = [...deletedRanges, { startTime, endTime }];

        selectedCells = new Set();
        anchorCell = null;
        collapsingCells = new Set();
        editMode = false;

        if (scrollContainer) scrollContainer.scrollLeft = 0;
    }

    function toggleEditMode() {
        editMode = !editMode;
        if (!editMode) {
            selectedCells = new Set();
            anchorCell = null;
        }
    }

    function handleVideoClick() {
        if (!videoEl) return;
        if (paused) {
            showPlayIcon = true;
            paused = false;
        } else {
            showPauseIcon = true;
            paused = true;
        }
        setTimeout(() => {
            showPlayIcon = false;
            showPauseIcon = false;
        }, 600);
    }

    function safeSeek(targetTime: number) {
        for (const range of deletedRanges) {
            if (targetTime >= range.startTime && targetTime < range.endTime) {
                targetTime = range.endTime;
                break;
            }
        }
        if (videoEl) {
            videoEl.currentTime = Math.min(targetTime, videoEl.duration - 0.001);
        }
    }

    function effectiveToRawTime(effectiveTime: number): number {
        let remaining = effectiveTime;
        const sorted = [...deletedRanges].sort((a, b) => a.startTime - b.startTime);
        let cursor = 0;
        for (const del of sorted) {
            const keptDuration = del.startTime - cursor;
            if (remaining <= keptDuration) {
                return cursor + remaining;
            }
            remaining -= keptDuration;
            cursor = del.endTime;
        }
        return Math.min(cursor + remaining, videoEl?.duration ?? 0);
    }

    function handleTimeUpdate() {
        if (!videoEl || deletedRanges.length === 0) return;

        const pos = videoEl.currentTime;
        const duration = videoEl.duration;

        if (!isFinite(duration) || duration === 0) return;

        for (const range of deletedRanges) {
            if (pos >= range.startTime && pos < range.endTime) {
                const jumpTo = range.endTime;

                if (jumpTo >= duration) {
                    videoEl.pause();
                    videoEl.currentTime = Math.max(0, range.startTime - 0.001);
                    return;
                }

                requestAnimationFrame(() => {
                    if (videoEl && Math.abs(videoEl.currentTime - pos) < 0.1) {
                        videoEl.currentTime = jumpTo;
                    }
                });
                return;
            }
        }
    }

    $effect(() => {
        if (!videoEl) return;
        videoEl.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            videoEl?.removeEventListener('timeupdate', handleTimeUpdate);
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

    onMount(() => {
        if (!videoUrl) return;
        const thumbVideo = document.createElement('video');
        thumbVideo.src = videoUrl;
        thumbVideo.muted = true;
        let cancelled = false;

        (async () => {
            await new Promise<void>((resolve) => {
                thumbVideo.onloadedmetadata = () => resolve();
                thumbVideo.load();
            });
            const count = Math.round(thumbVideo.duration / SAMPLE_INTERVAL);
            for (let i = 0; i < count; i++) {
                if (cancelled) return;
                thumbVideo.currentTime = i * SAMPLE_INTERVAL;
                await new Promise<void>((resolve) => {
                    thumbVideo.onseeked = () => resolve();
                });
                if (cancelled) return;
                const canvas = document.createElement('canvas');
                canvas.width = CELL_WIDTH;
                canvas.height = CELL_HEIGHT;
                canvas.getContext('2d')?.drawImage(thumbVideo, 0, 0, CELL_WIDTH, CELL_HEIGHT);
                thumbnails.set(i, canvas.toDataURL('image/jpeg', 0.6));
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        })();

        return () => {
            cancelled = true;
            thumbVideo.src = '';
        };
    });
</script>

<div class="flex h-full flex-col">
    <!-- Video player -->
    <div class="relative min-h-0 flex-1 bg-black/20">
        {#if videoUrl}
            <div
                class="relative h-full cursor-pointer"
                onclick={handleVideoClick}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleVideoClick();
                    }
                }}
                aria-label="Toggle play/pause"
            >
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    bind:this={videoEl}
                    src={videoUrl}
                    bind:paused
                    bind:currentTime
                    bind:duration={videoDuration}
                    class="h-full w-full object-contain"
                ></video>
                {#if showPlayIcon || showPauseIcon}
                    <div
                        class="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                        <div class="animate-ping-once text-indigo-500">
                            {#if showPlayIcon}
                                <Play size={96} fill="currentColor" />
                            {:else}
                                <Pause size={96} fill="currentColor" />
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
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
        <span class="min-w-22.5 font-mono text-sm text-muted-foreground tabular-nums">
            {formatTime(effectiveCurrentTime)} / {formatTime(effectiveDuration)}
        </span>
        <input
            type="range"
            class="flex-1 accent-indigo-500"
            min="0"
            max={effectiveDuration || 1}
            step={1 / FRAME_RATE}
            value={effectiveCurrentTime}
            oninput={(e) => {
                const effectiveTarget = parseFloat(e.currentTarget.value);
                safeSeek(effectiveToRawTime(effectiveTarget));
            }}
        />
    </div>

    <!-- Toolbar -->
    <div class="flex items-center gap-2 border-t px-4 py-2">
        <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onclick={toggleEditMode}
            class={editMode ? 'border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600' : ''}
        >
            <Scissors class="mr-1 size-4" />
            {editMode ? 'Selecting…' : 'Cut'}
        </Button>
        {#if editMode && selectedCells.size > 0}
            <Button variant="destructive" size="sm" onclick={deleteSelectedCells}>
                <Trash2 class="mr-1 size-4" />
                Delete
            </Button>
        {/if}
        <div class="flex-1"></div>
        <span class="text-sm text-muted-foreground">Final: {formatTime(effectiveDuration)}</span>
    </div>

    <!-- Frame strip -->
    {#if videoDuration > 0}
        <div
            bind:this={scrollContainer}
            class="overflow-x-auto border-t"
            bind:clientWidth={containerWidth}
            onscroll={(e) => (scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft)}
        >
            <div
                style="width: {totalStripWidth}px; position: relative; display: flex; align-items: flex-start; height: {CELL_HEIGHT +
                    12}px; transition: width 250ms ease;"
            >
                {#if currentCellPos >= 0}
                    <div
                        class="pointer-events-none absolute top-0 z-10 w-0.5 bg-indigo-500"
                        style="left: {currentCellPos * CELL_STRIDE}px; height: {CELL_HEIGHT}px;"
                    ></div>
                {/if}
                <div style="width: {leftSpacerWidth}px; flex-shrink: 0;"></div>

                {#each visibleCells.slice(posStart, posEnd + 1) as cellIndex (cellIndex)}
                    <div
                        class="frame-cell shrink-0"
                        class:active={cellIndex === currentCell}
                        class:selected={selectedCells.has(cellIndex)}
                        class:collapsing={collapsingCells.has(cellIndex)}
                        style="width: {CELL_WIDTH}px; height: {CELL_HEIGHT}px; margin-right: {CELL_GAP}px; position: relative;"
                        role="button"
                        tabindex="0"
                        onclick={() => handleCellClick(cellIndex)}
                        onkeydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleCellClick(cellIndex);
                        }}
                    >
                        {#if thumbnails.has(cellIndex)}
                            <img
                                src={thumbnails.get(cellIndex)}
                                width={CELL_WIDTH}
                                height={CELL_HEIGHT}
                                alt=""
                                class="block"
                            />
                        {:else}
                            <div
                                class="animate-pulse bg-muted-foreground/20"
                                style="width: {CELL_WIDTH}px; height: {CELL_HEIGHT}px;"
                            ></div>
                        {/if}
                        {#if cellIndex === currentCell}
                            <div
                                class="pointer-events-none absolute inset-0 z-10 bg-indigo-500/30"
                            ></div>
                        {/if}
                        {#if selectedCells.has(cellIndex)}
                            <div
                                class="pointer-events-none absolute inset-0 z-10 bg-red-500/20"
                            ></div>
                        {/if}
                    </div>
                {/each}
            </div>

            <!-- Timestamp labels — reactive to effectiveDuration and visible cell count -->
            <div class="relative h-5 overflow-hidden" style="width: {totalStripWidth}px;">
                {#each timestampLabels as { visibleIndex, label } (visibleIndex)}
                    <span
                        class="absolute -translate-x-1/2 text-xs text-muted-foreground"
                        style="left: {visibleIndex * CELL_STRIDE}px;"
                    >
                        {label}
                    </span>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Footer -->
    <div class="flex items-center border-t px-4 py-3">
        <Button variant="ghost" size="sm" onclick={onback}>
            <ChevronLeft class="mr-1 size-4" />
            Back to Review
        </Button>
        <div class="flex-1"></div>
        <Button
            class="bg-indigo-500 text-white hover:bg-indigo-600"
            onclick={() => onexport(deletedRanges, videoDuration)}>Export & Download</Button
        >
    </div>
</div>

<style>
    .frame-cell {
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 2px;
        overflow: hidden;
        transition:
            width 250ms ease,
            margin 250ms ease,
            opacity 250ms ease;
    }
    .frame-cell.active {
        border-color: #6366f1;
    }
    .frame-cell.selected {
        border-color: #ef4444;
    }
    .frame-cell.collapsing {
        width: 0 !important;
        margin-right: 0 !important;
        opacity: 0;
    }
</style>
