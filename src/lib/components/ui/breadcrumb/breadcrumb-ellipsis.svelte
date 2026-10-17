<script lang="ts">
    import { MoreHorizontalIcon } from '@hugeicons/core-free-icons';
    import type { HTMLAttributes } from 'svelte/elements';

    import Icon from '$lib/components/Icon.svelte';

    import { cn, type WithElementRef, type WithoutChildren } from '$lib/utils.js';

    let {
        ref = $bindable(null),
        class: className,
        ...restProps
    }: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> = $props();
</script>

<span
    bind:this={ref}
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden="true"
    class={cn('flex size-5 items-center justify-center [&>svg]:size-4', className)}
    {...restProps}
>
    <Icon icon={MoreHorizontalIcon} />
    <span class="sr-only">More</span>
</span>
