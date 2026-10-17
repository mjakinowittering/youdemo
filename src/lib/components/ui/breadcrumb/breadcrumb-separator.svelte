<script lang="ts">
    import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
    import type { HTMLLiAttributes } from 'svelte/elements';

    import Icon from '$lib/components/Icon.svelte';

    import { cn, type WithElementRef } from '$lib/utils.js';

    let {
        ref = $bindable(null),
        class: className,
        children,
        ...restProps
    }: WithElementRef<HTMLLiAttributes> = $props();
</script>

<li
    bind:this={ref}
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden="true"
    class={cn('[&>svg]:size-3.5', className)}
    {...restProps}
>
    {#if children}
        {@render children?.()}
    {:else}
        <Icon icon={ArrowRight01Icon} class="cn-rtl-flip" />
    {/if}
</li>
