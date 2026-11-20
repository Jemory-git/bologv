interface IUseThrottle {
    [key: string]: boolean;
}

export function useThrottle<T extends Record<string, any> = { cooldown: boolean }>(ms: number = 300) {
    const target: { _cooldown: boolean } = { _cooldown: false }
    return new Proxy(target, {
        get(target) {
            return target._cooldown ?
                true :
                (target._cooldown = true, setTimeout(() => target._cooldown = false, ms), false)
        }
    }) as unknown as T & IUseThrottle;
}