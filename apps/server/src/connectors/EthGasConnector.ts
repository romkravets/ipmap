import { broadcast } from "../ws/broadcaster.js";
import type { EthGas } from "@sessionmap/types";

const API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

interface EtherscanGasResponse {
  status: string;
  result: {
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
  };
}

async function fetchGas(): Promise<EthGas | null> {
  try {
    const url = `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as EtherscanGasResponse;
    if (json.status !== "1") return null;
    return {
      slow: parseInt(json.result.SafeGasPrice, 10),
      standard: parseInt(json.result.ProposeGasPrice, 10),
      fast: parseInt(json.result.FastGasPrice, 10),
    };
  } catch {
    return null;
  }
}

export function startEthGasConnector() {
  async function poll() {
    const gas = await fetchGas();
    if (!gas) return;
    broadcast({ type: "gas", data: gas });
    console.log(`[EthGas] slow=${gas.slow} std=${gas.standard} fast=${gas.fast} gwei`);
  }

  poll();
  setInterval(poll, 60_000);
}
