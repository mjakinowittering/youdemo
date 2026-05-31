const KEYS = { webcam: 'ydWebcamDeviceId', mic: 'ydMicDeviceId' };

function load(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
}

function persist(key: string, value: string | null): void {
    if (typeof localStorage === 'undefined') return;
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
}

let _webcamDeviceId = $state<string | null>(load(KEYS.webcam));
let _micDeviceId = $state<string | null>(load(KEYS.mic));

export const deviceStore = {
    get webcamDeviceId(): string | null {
        return _webcamDeviceId;
    },
    set webcamDeviceId(v: string | null) {
        _webcamDeviceId = v;
        persist(KEYS.webcam, v);
    },
    get micDeviceId(): string | null {
        return _micDeviceId;
    },
    set micDeviceId(v: string | null) {
        _micDeviceId = v;
        persist(KEYS.mic, v);
    }
};
