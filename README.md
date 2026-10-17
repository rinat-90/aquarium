# Finny Animation v1

Applies on top of Finny v7. Only two files change:

- `apps/web/src/components/Fish3D/Fish3DPreview.tsx`
- `apps/web/src/components/Fish3D/createFinny3DModel.ts`

Adds gentle tail wag, pectoral fin flutter, float and sway, and a periodic blink. Other species' animation is unchanged. No backend changes or premium locking.

From repository root:

```sh
unzip -o ~/Downloads/finny-animation-v1.zip
pnpm exec prettier --write apps/web/src/components/Fish3D/Fish3DPreview.tsx apps/web/src/components/Fish3D/createFinny3DModel.ts
pnpm --filter @aquarium/web typecheck && pnpm --filter @aquarium/web build
```

Test in Create Fish > 3D > Finny. Blink repeats every 4.7 seconds. No browser build has been run here.
