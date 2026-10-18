<script lang="ts">
    import { Delete02Icon, Download04Icon, Tick02Icon } from '@hugeicons/core-free-icons';
    import { prefersReducedMotion } from 'svelte/motion';
    import { fly } from 'svelte/transition';

    import Icon from '$lib/components/Icon.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    interface Props {
        /** Trim mode: Discard and Export make way for Done trimming. */
        trimming?: boolean;
        /** Joining or exporting: both wait. */
        disabled?: boolean;
        /** Joining: says why they wait. */
        preparing?: boolean;
        ondiscard: () => void;
        onexport: () => void;
        ondonetrimming: () => void;
    }

    let {
        trimming = false,
        disabled = false,
        preparing = false,
        ondiscard,
        onexport,
        ondonetrimming
    }: Props = $props();
</script>

<!-- Both states share one grid cell, so Discard and Export can slide down and fade
     (200 ms) as trimming starts, while Done trimming is already in place -->
<div
    data-section="footer"
    class="grid h-19 shrink-0 items-center border-t-[1.5px] border-solid border-yd-ink bg-yd-base px-6"
>
    {#if trimming}
        <div class="col-start-1 row-start-1 flex items-center gap-3.5">
            <p class="text-small text-yd-muted">Export and discard are hidden while you trim.</p>
            <span class="flex-1"></span>
            <Button variant="primary" onclick={ondonetrimming}>
                <Icon icon={Tick02Icon} />Done trimming
            </Button>
        </div>
    {:else}
        <div
            class="col-start-1 row-start-1 flex items-center gap-3.5"
            out:fly={{ y: 16, duration: prefersReducedMotion.current ? 0 : 200 }}
        >
            {#if preparing}
                <span class="text-small text-yd-muted">Preparing your timeline…</span>
            {/if}
            <span class="flex-1"></span>
            <Button variant="danger-ghost" {disabled} onclick={ondiscard}>
                <Icon icon={Delete02Icon} />Discard
            </Button>
            <Button variant="primary" {disabled} onclick={onexport}>
                <Icon icon={Download04Icon} />Export
            </Button>
        </div>
    {/if}
</div>
