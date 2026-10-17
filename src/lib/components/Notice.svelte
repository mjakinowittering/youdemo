<script lang="ts">
    import { Cancel01Icon } from '@hugeicons/core-free-icons';
    import type { IconSvgElement } from '@hugeicons/svelte';
    import type { Snippet } from 'svelte';

    import { Alert } from '$lib/components/ui/alert/index.js';
    import { Button } from '$lib/components/ui/button/index.js';

    import { cn } from '$lib/utils.js';

    import Icon from './Icon.svelte';

    interface Props {
        icon: IconSvgElement;
        /** A titled notice: the title in row style above the body, icon on top. */
        title?: string;
        ondismiss?: () => void;
        class?: string;
        children: Snippet;
    }

    let { icon, title, ondismiss, class: className, children }: Props = $props();
</script>

<!-- Success notice: tint ground, ink outline, radius 14 -->
<Alert
    role="status"
    class={cn(
        'flex gap-3 rounded-notice border-[1.5px] border-solid border-yd-ink bg-yd-success-tint text-body text-yd-ink has-[>svg]:gap-x-3 *:[svg]:translate-y-0',
        title ? 'items-start p-4' : 'items-center py-2.5 pr-3 pl-4',
        className
    )}
>
    <Icon {icon} size={title ? 24 : 22} class={title ? 'size-6' : 'size-[22px]'} />
    {#if title}
        <div>
            <p class="text-row text-[17px]">{title}</p>
            <p class="text-body text-yd-muted">{@render children()}</p>
        </div>
    {:else}
        <p class="text-body text-yd-ink">{@render children()}</p>
        {#if ondismiss}
            <span class="flex-1"></span>
            <Button variant="ghost" size="icon" aria-label="Dismiss" onclick={ondismiss}>
                <Icon icon={Cancel01Icon} size={18} />
            </Button>
        {/if}
    {/if}
</Alert>
