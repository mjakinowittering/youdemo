<script lang="ts">
    import { onMount } from 'svelte';

    interface Props {
        oncomplete: () => void;
    }

    let { oncomplete }: Props = $props();

    let count = $state(3);

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

    onMount(() => {
        document.title = '3… | ScreenCast';
        playBeep();
        const t1 = setTimeout(() => {
            count = 2;
            document.title = '2… | ScreenCast';
            playBeep();
        }, 1000);
        const t2 = setTimeout(() => {
            count = 1;
            document.title = '1… | ScreenCast';
            playBeep();
        }, 2000);
        const t3 = setTimeout(oncomplete, 3000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            document.title = 'ScreenCast';
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

<div class="absolute inset-0 flex items-center justify-center bg-black/60">
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
            {#key count}
                <circle
                    cx="90"
                    cy="90"
                    r={R}
                    fill="none"
                    stroke="white"
                    stroke-width="5"
                    stroke-linecap="round"
                    stroke-dasharray={CIRC}
                    class="ring-arc"
                />
            {/key}
        </svg>

        <div class="absolute inset-0" style="display:grid;place-items:center;perspective:400px">
            {#key count}
                <span
                    class="text-7xl font-bold text-white tabular-nums select-none [backface-visibility:hidden] [grid-area:1/1]"
                    in:flipIn
                    out:flipOut>{count}</span
                >
            {/key}
        </div>
    </div>
</div>

<style>
    .ring-arc {
        stroke-dashoffset: 0;
        animation: deplete 1s linear forwards;
    }

    @keyframes deplete {
        from {
            stroke-dashoffset: 0;
        }
        to {
            stroke-dashoffset: 452.4;
        }
    }
</style>
