<script lang="ts">
    import { onMount } from 'svelte';

    interface Props {
        oncomplete: () => void;
        count?: number;
    }

    let { oncomplete, count = $bindable(3) }: Props = $props();

    const R = 72;
    const CIRC = 452.4; // ≈ 2π × R

    function playBeep() {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
            osc.onended = () => ctx.close();
        } catch {
            // AudioContext unavailable — silent countdown
        }
    }

    // 3, 2, 1 each get a full-second animation; 0 is a brief static flash.
    const STEP = 1000;
    const ZERO_HOLD = 300;

    onMount(() => {
        count = 3;
        playBeep();
        const t1 = setTimeout(() => {
            count = 2;
            playBeep();
        }, STEP);
        const t2 = setTimeout(() => {
            count = 1;
            playBeep();
        }, STEP * 2);
        const t3 = setTimeout(() => {
            count = 0;
            playBeep();
        }, STEP * 3);
        const t4 = setTimeout(oncomplete, STEP * 3 + ZERO_HOLD);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    });

    function flipIn(_node: Element) {
        return {
            duration: 250,
            css: (t: number) => `transform: rotateX(${(1 - t) * -90}deg); opacity: ${t};`
        };
    }

    function flipOut(_node: Element) {
        return {
            duration: 200,
            css: (t: number) => `transform: rotateX(${(1 - t) * 90}deg); opacity: ${t};`
        };
    }
</script>

<div class="absolute inset-0 flex items-center justify-center bg-black/20">
    <div class="relative" style="width:180px;height:180px">
        <svg
            width="180"
            height="180"
            viewBox="0 0 180 180"
            class="absolute inset-0 -rotate-90"
            aria-hidden="true"
        >
            <circle
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke="white"
                stroke-opacity="0.2"
                stroke-width="5"
            />
            {#if count > 0}
                {#key count}
                    <circle
                        cx="90"
                        cy="90"
                        r={R}
                        fill="none"
                        stroke-width="5"
                        stroke-linecap="round"
                        stroke-dasharray={CIRC}
                        class="animate-deplete stroke-indigo-500 [stroke-dashoffset:0]"
                    />
                {/key}
            {/if}
        </svg>

        <div class="absolute inset-0" style="display:grid;place-items:center;perspective:400px">
            {#if count > 0}
                {#key count}
                    <span
                        class="text-7xl font-bold text-indigo-500 tabular-nums select-none [grid-area:1/1] backface-hidden"
                        in:flipIn
                        out:flipOut>{count}</span
                    >
                {/key}
            {:else}
                <span
                    class="text-7xl font-bold text-indigo-500 tabular-nums select-none [grid-area:1/1] backface-hidden"
                    >0</span
                >
            {/if}
        </div>
    </div>
</div>
