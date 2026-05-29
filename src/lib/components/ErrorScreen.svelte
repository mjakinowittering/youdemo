<script lang="ts">
    import { Copy, RefreshCw, Skull } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button';

    let { error = '' }: { error: string } = $props();

    async function copyError() {
        await navigator.clipboard.writeText(error);
    }
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
    <Skull class="text-destructive" size={128} />
    <div class="space-y-2">
        <h2 class="text-xl font-semibold">Something went wrong</h2>
        <p class="max-w-md text-sm text-muted-foreground">YourDemo ran into an unexpected error.</p>
    </div>
    <pre
        class="max-h-40 w-full max-w-lg overflow-auto rounded-md bg-muted p-4 text-left text-xs whitespace-pre-wrap">{error}</pre>
    <div class="flex gap-3">
        <Button variant="outline" onclick={copyError}>
            <Copy class="mr-2 h-4 w-4" /> Copy error
        </Button>
        <Button onclick={() => window.location.reload()}>
            <RefreshCw class="mr-2 h-4 w-4" /> Reload YourDemo
        </Button>
    </div>
</div>
