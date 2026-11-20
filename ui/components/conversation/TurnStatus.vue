<template>
  <div class="turn-status">
    <span class="dot" aria-hidden="true" />
    BLG 正在处理…
  </div>
</template>

<style scoped lang="scss">
.turn-status {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--muted);
  font-size: 1.2rem;
}

.dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 99.9rem;
  background: var(--accent);
}

@media (prefers-reduced-motion: no-preference) {
  .dot {
    animation: pulse 1.1s ease-in-out infinite;
  }

  @keyframes pulse {

    0%,
    100% {
      opacity: 0.35;
    }

    50% {
      opacity: 1;
    }
  }
}
</style>
