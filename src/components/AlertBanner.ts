export class AlertBanner {
  private el: HTMLElement;

  constructor(elementId: string = 'alertBox') {
    this.el = document.getElementById(elementId) as HTMLElement;
  }

  public show(message: string, type: 'error' | 'success' | 'info' = 'error'): void {
    if (!this.el) return;
    this.el.className = `alert ${type}`;
    this.el.textContent = message;
    this.el.classList.remove('hidden');
  }

  public clear(): void {
    if (!this.el) return;
    this.el.classList.add('hidden');
    this.el.textContent = '';
  }
}
