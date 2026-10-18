<script lang="ts">
    import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

    import Icon from './Icon.svelte';
    import ListCard from './ListCard.svelte';
    import Pill from './Pill.svelte';

    export interface StatusRow {
        name: string;
        available: boolean;
        optional?: boolean;
    }

    interface Props {
        rows: StatusRow[];
        class?: string;
    }

    let { rows, class: className }: Props = $props();
</script>

<!-- Each capability in words: icon, name, optional "Optional", status pill -->
<ListCard class={className}>
    {#each rows as row (row.name)}
        <li>
            {#if row.available}
                <Icon icon={CheckmarkCircle02Icon} size={24} />
            {:else}
                <Icon icon={Cancel01Icon} size={24} class="text-yd-danger" />
            {/if}
            <span class="font-semibold">{row.name}</span>
            <span class="flex-1"></span>
            {#if row.optional}
                <span class="text-small text-yd-muted">Optional</span>
            {/if}
            <Pill variant={row.available ? 'on' : 'off'}>
                {row.available ? 'Available' : 'Not available'}
            </Pill>
        </li>
    {/each}
</ListCard>
