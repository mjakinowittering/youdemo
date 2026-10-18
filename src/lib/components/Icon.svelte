<script lang="ts">
    import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/svelte';

    import { cn } from '$lib/utils.js';

    interface Props {
        icon: IconSvgElement;
        size?: number;
        class?: string;
    }

    let { icon, size = 20, class: className }: Props = $props();
</script>

<!-- Hugeicons Stroke Rounded at its own 1.5 stroke. HugeiconsIcon only redraws
     on its other props, so a new `icon` remounts it (Mic → Muted and so on). -->
{#key icon}
    <HugeiconsIcon
        {icon}
        {size}
        stroke-linejoin="round"
        aria-hidden="true"
        class={cn('block shrink-0', className)}
    />
{/key}
