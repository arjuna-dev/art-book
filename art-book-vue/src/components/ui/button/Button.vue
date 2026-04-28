<script setup>
import { computed } from "vue";
import { cva } from "class-variance-authority";
import { cn } from "../../../lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "default",
  },
  size: {
    type: String,
    default: "default",
  },
  class: {
    type: [String, Array, Object],
    default: "",
  },
});

const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button-default",
      secondary: "ui-button-secondary",
      ghost: "ui-button-ghost",
    },
    size: {
      default: "ui-button-size-default",
      sm: "ui-button-size-sm",
      icon: "ui-button-size-icon",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class));
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
