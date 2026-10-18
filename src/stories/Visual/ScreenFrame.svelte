<script lang="ts">
    import type { Snippet } from 'svelte';

    import AppShell from '$lib/components/AppShell.svelte';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    interface Props {
        /** The board's size: 1280×800, 1280×960 (Editor) or 390×844 (phone). */
        width?: number;
        height?: number;
        children: Snippet;
    }

    let { width = 1280, height = 800, children }: Props = $props();
</script>

<!-- A screen board (docs/design/reference/screens): the app shell at a fixed
     size, at the viewport's origin, so a dialog's fixed overlay covers it exactly -->
<Tooltip.Provider>
    <AppShell
        data-compare="root"
        class="relative overflow-hidden"
        style="width: {width}px; height: {height}px"
    >
        {@render children()}
    </AppShell>
</Tooltip.Provider>
