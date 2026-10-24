export class AuthRequestEpoch {
  private currentEpoch = 0;

  begin(): number {
    this.currentEpoch += 1;
    return this.currentEpoch;
  }

  invalidate(): void {
    this.currentEpoch += 1;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.currentEpoch;
  }
}
