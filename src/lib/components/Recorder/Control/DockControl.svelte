<script lang="ts">
    import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
    import type { IconSvgElement } from '@hugeicons/svelte';
    import type { Snippet } from 'svelte';

    import Icon from '$lib/components/Icon.svelte';
    import { menuClass, tooltipClass } from '$lib/components/styles.js';
    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import { cn } from '$lib/utils.js';

    interface Props {
        icon: IconSvgElement;
        /** The state in a word: "Mic", "Muted", "Blur on"… */
        label: string;
        /** `off` is danger-tint, `on` success-tint; every state also has its word. */
        tone?: 'plain' | 'off' | 'on';
        /** aria-label for the toggle: the action it takes. */
        action: string;
        /** aria-label for the chevron. */
        menuLabel: string;
        tooltip: string;
        disabled?: boolean;
        ontoggle: () => void;
        /** The menu rows (MenuOptions). */
        menu: Snippet;
    }

    let {
        icon,
        label,
        tone = 'plain',
        action,
        menuLabel,
        tooltip,
        disabled = false,
        ontoggle,
        menu
    }: Props = $props();

    const tones = {
        plain: '',
        // A tone keeps its tint when locked; only the outline turns dashed
        off: 'bg-yd-danger-tint text-yd-danger disabled:bg-yd-danger-tint disabled:text-yd-danger',
        on: 'bg-yd-success-tint disabled:bg-yd-success-tint'
    };

    // The pair shares one shadow and presses as one; the halves have none of their own
    let half = $derived(
        cn(
            buttonVariants({ variant: 'ghost' }),
            'mb-0 shadow-none not-disabled:not-aria-disabled:hover:translate-y-0 not-disabled:not-aria-disabled:hover:shadow-none',
            tones[tone]
        )
    );
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <div
                {...props}
                class={cn(
                    'mb-1 inline-flex items-stretch rounded-control transition-[translate,box-shadow] duration-[120ms] motion-reduce:transition-none',
                    disabled
                        ? 'shadow-none'
                        : 'shadow-offset has-[button:hover]:translate-y-0.5 has-[button:hover]:shadow-offset-press'
                )}
            >
                <button
                    type="button"
                    class={cn(half, 'rounded-r-none')}
                    {disabled}
                    aria-label={action}
                    onclick={ontoggle}
                >
                    <Icon {icon} /><span>{label}</span>
                </button>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        class={cn(half, 'rounded-l-none border-l-0 px-2.5')}
                        {disabled}
                        aria-label={menuLabel}
                    >
                        <Icon icon={ArrowDown01Icon} size={18} />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content class={menuClass}>
                        {@render menu()}
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content class={tooltipClass} arrowClasses="hidden">{tooltip}</Tooltip.Content>
</Tooltip.Root>
