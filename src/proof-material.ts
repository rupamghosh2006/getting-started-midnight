import { randomBytes } from 'node:crypto';

export type PrivateProofMaterial = {
  secret: Uint8Array;
  salt: Uint8Array;
};

function bytesFromHex(value: string, name: string): Uint8Array {
  const normalized = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error(`${name} must be exactly 32 bytes encoded as 64 hexadecimal characters.`);
  }
  return Uint8Array.from(Buffer.from(normalized, 'hex'));
}

export function proofMaterialFromEnvironment(): PrivateProofMaterial {
  const secret = process.env.PRIVATE_PROOF_SECRET_HEX;
  const salt = process.env.PRIVATE_PROOF_SALT_HEX;
  if (!secret || !salt) {
    throw new Error(
      'Set PRIVATE_PROOF_SECRET_HEX and PRIVATE_PROOF_SALT_HEX before using the CLI proof flow.',
    );
  }
  return {
    secret: bytesFromHex(secret, 'PRIVATE_PROOF_SECRET_HEX'),
    salt: bytesFromHex(salt, 'PRIVATE_PROOF_SALT_HEX'),
  };
}

export function deploymentProofMaterial(): { material: PrivateProofMaterial; generated: boolean } {
  const secret = process.env.PRIVATE_PROOF_SECRET_HEX;
  const salt = process.env.PRIVATE_PROOF_SALT_HEX;
  if (secret || salt) return { material: proofMaterialFromEnvironment(), generated: false };
  return {
    material: { secret: randomBytes(32), salt: randomBytes(32) },
    generated: true,
  };
}

export function materialAsEnvironment(material: PrivateProofMaterial): string {
  return [
    `PRIVATE_PROOF_SECRET_HEX=${Buffer.from(material.secret).toString('hex')}`,
    `PRIVATE_PROOF_SALT_HEX=${Buffer.from(material.salt).toString('hex')}`,
  ].join('\n');
}
