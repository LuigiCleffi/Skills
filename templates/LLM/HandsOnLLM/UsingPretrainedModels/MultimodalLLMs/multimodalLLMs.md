---
name: hollm-multimodal-llms
description: "Multimodal language models for text and images: the Vision Transformer (images split into patches embedded like tokens), multimodal embedding models such as CLIP and OpenCLIP trained contrastively on image-caption pairs, zero-shot image classification, cross-modal search and clustering, image preprocessing and normalization, interpreting similarity scores, and making text generators see with BLIP-2 (frozen ViT and LLM bridged by a trained Q-Former producing soft visual prompts), LLaVA-style projection, image captioning and visual question answering with chat-style prompts, based on Chapter 9 (Multimodal Large Language Models) of Jay Alammar and Maarten Grootendorst's Hands-On Large Language Models. Use when searching images by text or text by image, zero-shot labeling of images, captioning product or photo catalogs, answering questions about images, choosing a vision-language model, or debugging distorted or misread image inputs."
---

# Multimodal Large Language Models

Images enter language models the same way text does: cut into pieces, embedded, and processed by a Transformer. Use shared text–image embedding spaces (CLIP) for search and zero-shot classification, and vision-language generators (BLIP-2, LLaVA-style) when you need the model to describe or reason about an image in words.

## How images become tokens

- The Vision Transformer (ViT) splits an image into fixed-size patches (16x16 pixels in the original), flattens and linearly embeds each patch, and feeds the sequence to a Transformer encoder.
- Patches have no vocabulary IDs (they rarely repeat), so they are embedded directly rather than looked up.
- After embedding, the encoder treats patches like text tokens; this is why ViT is the usual vision component of multimodal models.

## Multimodal embeddings: CLIP

- CLIP has a text encoder and an image encoder whose outputs share one vector space.
- Trained contrastively on image–caption pairs: matching pairs pulled together, mismatched pairs pushed apart (negatives are essential).

| Task | How |
|---|---|
| Zero-shot image classification | Embed class descriptions ("a photo of a cat"), pick the most similar |
| Text-to-image / image-to-text search | Embed both sides, nearest neighbors |
| Clustering images with keywords | Embed images and candidate keywords together |
| Conditioning image generation | Text embeddings drive diffusion models |

```python
from sentence_transformers import SentenceTransformer, util
clip = SentenceTransformer("clip-ViT-B-32")
img_emb = clip.encode(images)              # list of PIL images
txt_emb = clip.encode(["a puppy playing in the snow", "a sports car at sunset"])
sim = util.cos_sim(img_emb, txt_emb)       # [n_images, n_texts]
```

- Normalize embeddings before dot products; raw cosine scores have no absolute meaning (a "high" CLIP score may look small). Compare scores relatively across candidates, or calibrate thresholds on labeled examples.
- With `transformers`, text goes through the CLIP tokenizer and images through the processor; both must come from the same checkpoint.

## Preprocessing pitfalls

- Processors resize to the model's input size (224x224 for these models) and normalize pixels; very wide or tall images are squashed and can be misread. Crop or pad to preserve aspect ratio when detail matters.
- Convert to RGB before processing (grayscale, alpha channels break or alter inputs).
- Use the processor's tokenizer for text prompts; its special tokens and space markers (such as `Ġ` in GPT-2-style BPE) differ by model.

## Making text generators see: BLIP-2

- Training a vision-language model from scratch needs enormous data and compute; BLIP-2 reuses a frozen ViT and a frozen LLM and trains only a bridge, the Q-Former.
- Stage 1 (representation learning) on image–text pairs with three objectives: image–text contrastive learning, image–text matching (classification), and image-grounded text generation.
- Stage 2: Q-Former outputs pass through a linear projection into the LLM's embedding size and act as **soft visual prompts** prepended to the text.
- LLaVA and Idefics-style models follow the same pattern: a CLIP-like encoder plus a projection into a text LLM.

```python
import torch
from transformers import AutoProcessor, Blip2ForConditionalGeneration
proc = AutoProcessor.from_pretrained("Salesforce/blip2-opt-2.7b")
model = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b",
                                                      torch_dtype=torch.float16).to("cuda")
prompt = "Question: What is in this picture? Answer:"
inputs = proc(image, text=prompt, return_tensors="pt").to("cuda", torch.float16)
answer = proc.batch_decode(model.generate(**inputs, max_new_tokens=30), skip_special_tokens=True)[0].strip()
```

## Use cases and limits

- **Captioning**: no prompt; useful for catalogs and photo libraries. Fails more on domain-specific imagery (niche products, fictional characters) absent from public training data.
- **Visual question answering**: image + question prompt. Chat follows by concatenating previous Q/A turns into the prompt (a manual buffer memory); trim generated text at the next "Question" marker.
- Answers can be confidently made up (a specific price for a car); verify factual claims, especially numbers.
- **Current note:** native multimodal chat models that accept images (and often audio or video) directly now dominate over BLIP-2-era bridges; the patch-embedding, contrastive-alignment and projection ideas still describe how most of them work. Check each model's chat template for how images are inserted.

## Workflow

1. Decide representation (search, zero-shot labels, clustering) versus generation (captions, Q&A).
2. For representation, pick a CLIP-family model; embed a labeled sample and calibrate similarity thresholds.
3. For generation, pick a vision-language model that fits VRAM (half precision or quantization).
4. Standardize preprocessing (RGB, aspect handling) and test on extreme image shapes.
5. Write prompts in the model's expected format; bound `max_new_tokens`.
6. Evaluate on in-domain images with human review before automating.

## Red flags

- Absolute similarity thresholds copied from another model or dataset.
- Mixing image embeddings from one CLIP checkpoint with text embeddings from another.
- Feeding panoramas or documents without considering the 224x224 squash.
- Trusting VQA answers about prices, counts, or text in images without verification.
- Loading large vision-language models in full precision on small GPUs.

## Testing notes

- Shape tests: text and image embeddings must have equal dimension; pixel tensors `[batch, 3, H, W]` with expected H and W.
- Golden retrieval set: for each test image, the correct caption must rank top-1 (or top-k) among distractors.
- Zero-shot classification eval: accuracy/F1 on a small labeled in-domain image set.
- Snapshot captions with greedy decoding for regression, reviewed by a human when they change.
- Unit-test chat prompt assembly and answer trimming with stubbed generate output.

## Related

- `../SemanticSearchAndRAG/semanticSearchAndRAG.md` — the same retrieval patterns for images.
- `../TextClusteringAndTopicModeling/textClusteringAndTopicModeling.md` — multimodal topic modeling.
- `../../TrainingAndFineTuning/CreatingEmbeddingModels/creatingEmbeddingModels.md` — contrastive learning in depth.
- `../../UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` — tokens and embeddings for text.
- `../../../AIEngineering/Foundations/FoundationModels/foundationModels.md` — multimodal foundation models.
