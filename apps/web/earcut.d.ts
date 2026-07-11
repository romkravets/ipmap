declare module "earcut" {
  function earcut(
    data: number[],
    holeIndices?: number[],
    dim?: number,
  ): number[];
  export = earcut;
}
