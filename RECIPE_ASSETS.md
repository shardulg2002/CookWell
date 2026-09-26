# Original recipe illustrations

Generated with the built-in image-generation tool on 14 September 2026, not the fallback CLI/API. No paid image-generation service is called by the app. Each image is mapped only to its matching recipe and is visibly labelled **AI illustration**. Other recipes keep a neutral dish illustration. These are not photos of kitchen-tested dishes, proof of doneness, or measurements of a serving.

## Saved assets

- `public/images/eggs-toast.png` — Spinach eggs on toast.
- `public/images/dhal.png` — Red lentil & spinach dhal.
- `public/images/chicken-bean-rice.png` — Smoky chicken, beans & vegetable rice.

They are stored inside this repository and served from `/images/`; the app does not depend on the generator's original file location. Existing source outputs were copied, not deleted or overwritten.

## Final prompt set

Each asset used this shared specification, substituting the corresponding primary request below:

```text
Use case: photorealistic-natural
Asset type: CookWell recipe illustrative food photo
Primary request: [recipe-specific request below]
Scene/backdrop: A single ceramic off-white plate or shallow bowl on a pale warm stone table.
Style/medium: Natural editorial food photograph, appetising realistic home cooking with imperfect textures, not restaurant presentation.
Composition/framing: Square, close three-quarter overhead view, entire bowl inside frame with minimal surrounding space; food fills the center so it crops well to a thumbnail.
Lighting/mood: Soft window daylight, balanced natural colours.
Constraints: Original food image only, no text, logos, watermark, hands, utensils, props or extra food. Depict one plausible serving; not a nutrition or portion measurement diagram.
```

1. **eggs-toast**: Spinach eggs on toast. Soft scrambled fully cooked eggs and wilted spinach on two slices of wholemeal toast. Only these foods, a little oil used in cooking.
2. **dhal**: Red lentil and spinach dhal with brown rice. Thick orange-red cooked lentils, tomato and onion, wilted spinach, spices; brown rice beside the dhal. No dairy, garnish or flatbread.
3. **chicken-bean-rice**: Smoky chicken, kidney beans and vegetable rice. Cooked chicken pieces in a tomato-onion sauce with red kidney beans, small brown rice portion, peas, carrot and green beans. All ingredients cooked.

All three outputs were visually inspected before integration. Image portion sizes and appearances must never override the weighed recipe. A complete tested-photo/video library remains future work.
