<script lang="ts">
    import { Copy, RefreshCw, Skull } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';

    let { error = '' }: { error: string } = $props();

    async function copyError() {
        await navigator.clipboard.writeText(error);
    }
</script>

<div class="flex h-full items-center justify-center bg-black/20">
    <Card.Root
        class="max-w-xl flex-1 items-center justify-center border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent"
    >
        <Empty.Root>
            <Empty.Media>
                <Skull size={128} class="text-destructive" />
            </Empty.Media>
            <Empty.Header>
                <Empty.Title>Something went wrong</Empty.Title>
                <Empty.Description>YouDemo ran into an unexpected error.</Empty.Description>
            </Empty.Header>
            <Empty.Content>
                {#if error}
                    <pre
                        class="max-h-40 w-full max-w-lg overflow-auto rounded-md bg-muted p-4 text-left text-xs whitespace-pre-wrap">{error}</pre>
                {/if}
                <div class="flex gap-3">
                    <Button variant="outline" onclick={copyError} size="lg">
                        <Copy class="mr-2 size-4" /> Copy error
                    </Button>
                    <Button onclick={() => window.location.reload()} size="lg">
                        <RefreshCw class="mr-2 size-4" /> Reload YouDemo
                    </Button>
                </div>
            </Empty.Content>
        </Empty.Root>
    </Card.Root>
</div>
