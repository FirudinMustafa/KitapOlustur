// KIYAS-13 review: a source's numberless starter unit ("Say Hello!") is
// written as unit 0, and the book printed "UNIT 0" and a "0" badge - no
// published course numbers its welcome unit. Unit 0 prints as "Welcome".
export function unitKicker(n: number): string {
  return n === 0 ? "WELCOME" : `UNIT ${n}`;
}

export function unitName(n: number): string {
  return n === 0 ? "Welcome" : `Unit ${n}`;
}

export function unitBadgeText(n: number): string {
  return n === 0 ? "Hi!" : String(n);
}
