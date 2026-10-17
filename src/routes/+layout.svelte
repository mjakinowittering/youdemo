<script lang="ts">
    import './layout.css';

    import AppHeader from '$lib/components/AppHeader.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import favicon from '$lib/assets/favicon.svg';

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
    <div class="flex h-screen flex-col">
        <AppHeader />

        <main class="flex-1 overflow-auto">
            {@render children()}
        </main>
    </div>
</Tooltip.Provider>
