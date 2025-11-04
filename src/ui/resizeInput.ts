export function resizeInput(this: HTMLInputElement) {
  this.style.width = this.value.length + "ch";
}