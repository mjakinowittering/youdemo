<script lang="ts">
    import {
        CELL_GAP,
        CELL_HEIGHT,
        CELL_STRIDE,
        CELL_WIDTH,
        computeTimestampLabels,
        computeVirtualWindow
    } from '$lib/editorMath.js';

    interface Props {
        visibleCells?: number[];
        thumbnails?: Map<number, string>;
        currentCell?: number;
        selectedCells?: Set<number>;
        collapsingCells?: Set<number>;
        paused?: boolean;
        oncellclick?: (index: number) => void;
    }

    let {
        visibleCells = [],
        thumbnails = new Map<number, string>(),
        currentCell = 0,
        selectedCells = new Set<number>(),
        collapsingCells = new Set<number>(),
        paused = true,
        oncellclick
    }: Props = $props();

    let scrollContainer = $state<HTMLDivElement | undefined>(undefined);
    let scrollLeft = $state(0);
    let containerWidth = $state(0);

    // Map from original cell index → rendered (sequential) position in the strip.
    let cellRenderPos = $derived(new Map(visibleCells.map((idx, pos) => [idx, pos])));
    let currentCellPos = $derived(cellRenderPos.get(currentCell) ?? -1);

    let virtualWindow = $derived(
        computeVirtualWindow(scrollLeft, containerWidth, visibleCells.length)
    );
    let posStart = $derived(virtualWindow.posStart);
    let posEnd = $derived(virtualWindow.posEnd);
    let totalStripWidth = $derived(visibleCells.length * CELL_STRIDE);
    let leftSpacerWidth = $derived(posStart * CELL_STRIDE);
    let timestampLabels = $derived(computeTimestampLabels(visibleCells));

    // Keep the playhead in view while playing.
    $effect(() => {
        if (!scrollContainer || paused || currentCellPos < 0) return;
        const targetScrollLeft = currentCellPos * CELL_STRIDE - containerWidth / 2;
        scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
    });
</script>

{#if visibleCells.length > 0}
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
                    class={[
                        'shrink-0 cursor-pointer overflow-hidden rounded-xs border-2 transition-[width,margin,opacity] duration-250',
                        selectedCells.has(cellIndex)
                            ? 'border-red-500'
                            : cellIndex === currentCell
                              ? 'border-indigo-500'
                              : 'border-transparent',
                        collapsingCells.has(cellIndex) && 'mr-0! w-0! opacity-0'
                    ]}
                    style="width: {CELL_WIDTH}px; height: {CELL_HEIGHT}px; margin-right: {CELL_GAP}px; position: relative;"
                    role="button"
                    tabindex="0"
                    onclick={() => oncellclick?.(cellIndex)}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') oncellclick?.(cellIndex);
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
                        <div class="pointer-events-none absolute inset-0 z-10 bg-red-500/20"></div>
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
