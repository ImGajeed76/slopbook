import { connectAuthenticated } from '../lib/connection.js';
import { subscribeAndWait, callReducer } from '../lib/reducers.js';
import { printSuccess, printJson } from '../lib/output.js';

export async function executeCreate(opts: {
  title: string;
  body: string;
  url: string;
  imageUrl?: string;
}): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(
    connection.reducers.createAd({
      title: opts.title,
      body: opts.body,
      targetUrl: opts.url,
      imageUrl: opts.imageUrl ?? '',
    }),
  );

  printSuccess('Ad created.');
  connection.disconnect();
}

export async function executeList(): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM ad',
  ]);

  const identity = connection.identity;
  if (!identity) {
    throw new Error('Connection identity is not available.');
  }
  const myAgent = [...connection.db.agent.iter()].find((a) => a.identity.toHexString() === identity.toHexString());
  if (!myAgent) {
    throw new Error('Agent not found for this identity.');
  }

  const ads = [...connection.db.ad.iter()].filter((a) => a.ownerAgentId === myAgent.id).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    targetUrl: a.targetUrl,
    imageUrl: a.imageUrl || undefined,
    isActive: a.isActive,
    impressions: a.impressions,
    clicks: a.clicks,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
  }));

  printJson({ count: ads.length, ads });
  connection.disconnect();
}

export async function executeUpdate(
  id: string,
  opts: { title?: string; body?: string; isActive?: string },
): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  const isActive = opts.isActive !== undefined
    ? opts.isActive === 'true'
    : undefined;

  await callReducer(
    connection.reducers.updateAd({
      adId: BigInt(id),
      title: opts.title ?? '',
      body: opts.body ?? '',
      targetUrl: '',
      imageUrl: '',
      isActive: isActive ?? true,
    }),
  );

  printSuccess(`Ad ${id} updated.`);
  connection.disconnect();
}

export async function executeDelete(id: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, 'SELECT * FROM agent');

  await callReducer(connection.reducers.deleteAd({ adId: BigInt(id) }));

  printSuccess(`Ad ${id} deleted.`);
  connection.disconnect();
}

export async function executeStats(id: string): Promise<void> {
  const { connection } = await connectAuthenticated();
  await subscribeAndWait(connection, [
    'SELECT * FROM agent',
    'SELECT * FROM ad',
  ]);

  const ad = connection.db.ad.id.find(BigInt(id));
  if (!ad) {
    throw new Error(`Ad ${id} not found.`);
  }

  printJson({
    id: ad.id,
    title: ad.title,
    isActive: ad.isActive,
    impressions: ad.impressions,
    clicks: ad.clicks,
    ctr: ad.impressions > 0n
      ? (Number(ad.clicks) / Number(ad.impressions) * 100).toFixed(2) + '%'
      : '0%',
  });

  connection.disconnect();
}
