// const g = globalThis as Record<string, unknown>;

// if (typeof g.crypto !== "object" || g.crypto === null) {
//   g.crypto = {
//     randomUUID: () =>
//       "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
//         const r = (Math.random() * 16) | 0;
//         return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
//       }),
//   };
// } else if (
//   typeof (g.crypto as Record<string, unknown>).randomUUID !== "function"
// ) {
//   (g.crypto as Record<string, unknown>).randomUUID = () =>
//     "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
//       const r = (Math.random() * 16) | 0;
//       return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
//     });
// }
