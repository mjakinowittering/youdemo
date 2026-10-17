<script lang="ts">
    import { Loading03Icon, Move01Icon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
    import Pill from '$lib/components/Pill.svelte';

    import { srcObject } from '$lib/utils.js';

    interface Props {
        /** Diameter in px, outline included. */
        size: number;
        stream?: MediaStream | null;
        /** Blur is being set up: dims the raw preview under a spinner. */
        loading?: boolean;
        /** Shows the "Drag to move" pill under the bubble. */
        hint?: boolean;
    }

    let { size, stream = null, loading = false, hint = false }: Props = $props();
</script>

<!-- The camera in a circle: 2px ink outline and a hard 4px 4px shadow -->
<div class="flex flex-col items-center gap-2">
    <div
        class="relative shrink-0 overflow-hidden rounded-full border-2 border-solid border-yd-ink bg-yd-card shadow-bubble transition-[width,height] duration-150 ease-out motion-reduce:transition-none"
        style="width: {size}px; height: {size}px"
    >
        {#if stream}
            <video
                {@attach srcObject(stream)}
                autoplay
                muted
                playsinline
                class="size-full object-cover"
            ></video>
        {:else}
            <div class="size-full bg-yd-rule" data-compare-mask></div>
        {/if}
        {#if loading}
            <div
                role="status"
                class="absolute inset-0 flex items-center justify-center bg-yd-ink/50 text-yd-card"
            >
                <Icon
                    icon={Loading03Icon}
                    size={32}
                    class="animate-spin motion-reduce:animate-none"
                />
                <span class="sr-only">Loading background blur…</span>
            </div>
        {/if}
    </div>
    {#if hint}
        <Pill><Icon icon={Move01Icon} size={14} />Drag to move</Pill>
    {/if}
</div>
