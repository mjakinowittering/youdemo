<script lang="ts">
    import Download from '@lucide/svelte/icons/download';
    import Monitor from '@lucide/svelte/icons/monitor';
    import MonitorPlay from '@lucide/svelte/icons/monitor-play';
    import Scissors from '@lucide/svelte/icons/scissors';
    import { onMount } from 'svelte';

    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';

    const STORAGE_KEY = 'ydWelcomed';

    let open = $state(false);

    onMount(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            open = true;
        }
    });

    function dismiss() {
        localStorage.setItem(STORAGE_KEY, 'true');
        open = false;
    }
</script>

<Dialog.Root
    bind:open
    onOpenChange={(value) => {
        if (!value) dismiss();
    }}
>
    <Dialog.Content class="max-w-md" showCloseButton={false}>
        <div class="flex flex-col items-center gap-4 text-center">
            <MonitorPlay class="text-indigo-500" size={52} />
            <h2 class="text-xl font-semibold">Welcome to YouDemo</h2>
            <p class="text-sm text-muted-foreground">
                YouDemo lets you record your screen with a webcam overlay, trim the footage, and
                download it — all in the browser, all without signing up for anything.
            </p>
        </div>

        <Separator />

        <ul class="flex flex-col gap-3">
            <li class="flex items-center gap-3">
                <Monitor class="shrink-0 text-indigo-500" size={18} />
                <span class="text-sm"
                    >Record your screen with a webcam overlay and background blur</span
                >
            </li>
            <li class="flex items-center gap-3">
                <Scissors class="shrink-0 text-indigo-500" size={18} />
                <span class="text-sm">Trim the footage right in the browser</span>
            </li>
            <li class="flex items-center gap-3">
                <Download class="shrink-0 text-indigo-500" size={18} />
                <span class="text-sm">Download it — no sign-up, nothing uploaded</span>
            </li>
        </ul>

        <Button class="w-full bg-indigo-500 text-white hover:bg-indigo-600" onclick={dismiss}>
            Let's begin
        </Button>
    </Dialog.Content>
</Dialog.Root>
