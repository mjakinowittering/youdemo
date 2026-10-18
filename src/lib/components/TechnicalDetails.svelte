<script lang="ts">
    import { cn } from '$lib/utils.js';

    let { details, class: className }: { details: string; class?: string } = $props();
</script>

<!-- Collapsed by default: a link-styled summary, then the error in monospace -->
<details class={cn('text-small', className)}>
    <summary
        class="inline-flex min-h-8 cursor-pointer items-center text-button font-semibold text-yd-ink underline decoration-yd-accent decoration-[2.5px] underline-offset-4 hover:decoration-4"
    >
        Technical details
    </summary>
    <pre
        class="mt-2.5 font-mono text-meta leading-normal whitespace-pre-wrap text-yd-muted">{details}</pre>
</details>
