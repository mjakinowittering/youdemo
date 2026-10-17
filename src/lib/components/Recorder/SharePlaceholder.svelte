<script lang="ts">
    import { ComputerScreenShareIcon } from '@hugeicons/core-free-icons';

    import Icon from '$lib/components/Icon.svelte';
</script>

<!-- Stands in for the share before one is chosen (Setup, and Review once it ends) -->
<div class="flex flex-col items-center gap-2 text-center">
    <Icon icon={ComputerScreenShareIcon} size={40} />
    <p class="text-row">Your screen will show here</p>
    <p class="text-small text-yd-muted">A tab, a window or your whole screen</p>
</div>
