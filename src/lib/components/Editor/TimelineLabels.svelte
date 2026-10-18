<script lang="ts">
    import { cn } from '$lib/utils.js';

    interface Props {
        start: string;
        middle?: string;
        /** "mm:ss after cuts" */
        end: string;
        class?: string;
    }

    let { start, middle, end, class: className }: Props = $props();
</script>

<div class={cn('flex items-center gap-3.5', className)}>
    <span class="text-small text-yd-muted">{start}</span>
    <span class="flex-1"></span>
    {#if middle}
        <span class="text-small text-yd-muted">{middle}</span>
        <span class="flex-1"></span>
    {/if}
    <span class="text-small font-semibold text-yd-ink">{end}</span>
</div>
