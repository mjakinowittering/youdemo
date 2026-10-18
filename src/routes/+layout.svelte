<script lang="ts">
    import './layout.css';

    import AppShell from '$lib/components/AppShell.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import favicon from '$lib/assets/favicon.svg';

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<Tooltip.Provider>
    <AppShell class="h-screen">
        {@render children()}
    </AppShell>
</Tooltip.Provider>
