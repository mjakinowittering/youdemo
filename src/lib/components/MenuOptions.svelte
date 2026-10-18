<script lang="ts" generics="T extends string">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

    import { menuItemClass } from './styles.js';

    interface Props {
        options: { value: T; label: string }[];
        value: T | undefined;
        onselect: (value: T) => void;
        /** Shown as a disabled row when there are no options. */
        empty?: string;
    }

    let { options, value, onselect, empty }: Props = $props();
</script>

<!-- The rows of a device or intensity menu: 44px, the chosen one tinted and ticked -->
<DropdownMenu.RadioGroup {value} onValueChange={(v) => onselect(v as T)}>
    {#each options as option (option.value)}
        <DropdownMenu.RadioItem value={option.value} class={menuItemClass}>
            {option.label}
        </DropdownMenu.RadioItem>
    {/each}
</DropdownMenu.RadioGroup>
{#if options.length === 0 && empty}
    <DropdownMenu.Item disabled class={menuItemClass}>{empty}</DropdownMenu.Item>
{/if}
