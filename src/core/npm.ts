import fetch from 'node-fetch';

export interface NpmPackageMetadata {
  name: string;
  version: string;
  dist: {
    tarball: string;
    shasum: string;
    integrity: string;
  };
  anchor?: {
    wallet: string;
    network: 'mainnet' | 'testnet';
  };
}

export async function getPackageMetadata(pkgName: string, version?: string): Promise<NpmPackageMetadata> {
  const url = `https://registry.npmjs.org/${pkgName}/${version || 'latest'}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch package metadata for ${pkgName}: ${response.statusText}`);
  }
  
  return await response.json() as NpmPackageMetadata;
}

export async function downloadTarball(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download tarball from ${url}: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
