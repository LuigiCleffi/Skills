---
name: llm-scratch-working-with-text-data
description: "Preparing text for LLM training: tokenization, vocabularies and token IDs, special tokens (<|endoftext|>, unknown, padding), byte pair encoding with tiktoken, sliding-window input-target pairs with max_length and stride, PyTorch Dataset and DataLoader for next-token batches, token embedding layers as lookups, and absolute positional embeddings, based on Chapter 2 (Working with text data) of Sebastian Raschka's Build a Large Language Model (From Scratch). Use when writing a tokenizer or data pipeline for language-model training, choosing context length and stride, building input and target tensors, joining documents with end-of-text tokens, debugging off-by-one target shifts, unknown-token errors, or embedding shape mismatches."
---

# Working with Text Data

A language model never sees text: it sees integer token IDs turned into vectors. Get the pipeline text -> tokens -> IDs -> (inputs, targets shifted by one) -> token + position embeddings exactly right, and test it in isolation, because every later bug looks like a model bug.

## Tokenize with a subword tokenizer, not a homemade one

- A regex word splitter is fine for learning, but its vocabulary is closed: any unseen word fails (KeyError) or collapses to an unknown token.
- **Byte pair encoding (BPE)** builds its vocabulary by repeatedly merging frequent character pairs into subwords. Unknown words decompose into known subwords or single characters, so no unknown token is needed and any text can be encoded.
- Use the tokenizer that matches the model's weights. GPT-2 BPE (`tiktoken.get_encoding("gpt2")`) has 50,257 entries; `<|endoftext|>` is ID 50256.
- Keep case. Decide deliberately about whitespace: dropping it saves tokens, keeping it matters for code and layout-sensitive text (BPE keeps it).

```python
import tiktoken
tok = tiktoken.get_encoding("gpt2")
ids = tok.encode("Hello, do you like tea? <|endoftext|> In the sunlit terraces",
                 allowed_special={"<|endoftext|>"})
assert tok.decode(ids).startswith("Hello, do you like tea?")
assert 50256 in ids
```

## Special tokens

| Token | Purpose | GPT-2 practice |
|---|---|---|
| End of text | Separates unrelated documents concatenated into one stream | the end-of-text token (ID 50256), inserted between documents |
| Beginning of sequence | Marks where content starts | not used |
| Padding | Equalizes lengths in a batch | reuses the end-of-text token; padded positions are masked from the loss later |
| Unknown | Out-of-vocabulary word | not needed with BPE |

- Encoding special tokens must be explicit (`allowed_special`); never let user-supplied text inject them silently.

## Sliding-window input-target pairs

- The target sequence is the input shifted one token to the right: for window `x = ids[i:i+L]`, `y = ids[i+1:i+L+1]`. One window yields `L` prediction tasks at once.
- `max_length` (`L`) is the context the model trains on; `stride` is how far the window moves. `stride == max_length` uses every token once without overlap; a smaller stride overlaps windows and increases overfitting risk.
- `drop_last=True` avoids a short final batch that causes loss spikes; shuffle the training loader only.

```python
import torch
from torch.utils.data import Dataset, DataLoader

class NextTokenDataset(Dataset):
    def __init__(self, text, tokenizer, max_length, stride):
        ids = tokenizer.encode(text, allowed_special={"<|endoftext|>"})
        self.inputs, self.targets = [], []
        for i in range(0, len(ids) - max_length, stride):
            self.inputs.append(torch.tensor(ids[i:i + max_length]))
            self.targets.append(torch.tensor(ids[i + 1:i + max_length + 1]))

    def __len__(self):
        return len(self.inputs)

    def __getitem__(self, idx):
        return self.inputs[idx], self.targets[idx]

def make_loader(text, batch_size=8, max_length=256, stride=256, shuffle=True):
    ds = NextTokenDataset(text, tiktoken.get_encoding("gpt2"), max_length, stride)
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle, drop_last=True, num_workers=0)
```

## Embeddings

- `nn.Embedding(vocab_size, emb_dim)` is a trainable lookup table: row `i` is the vector for token `i` (equivalent to one-hot times a weight matrix, but cheaper). It is learned with the model, not borrowed from Word2Vec.
- Attention is order-agnostic, so add position information. GPT-2 uses **learned absolute positional embeddings**: a second `nn.Embedding(context_length, emb_dim)` indexed by `torch.arange(seq_len)` and added to the token embeddings (broadcast over the batch).
- Embedding size trades quality for cost: 768 in the smallest GPT-2, 12,288 in the largest GPT-3.

```python
vocab_size, emb_dim, context_length = 50257, 256, 4
tok_emb = torch.nn.Embedding(vocab_size, emb_dim)
pos_emb = torch.nn.Embedding(context_length, emb_dim)
batch = torch.randint(0, vocab_size, (8, context_length))      # (batch, seq)
x = tok_emb(batch) + pos_emb(torch.arange(context_length))     # (8, 4, 256)
assert x.shape == (8, context_length, emb_dim)
```

**Current note:** most recent open models use relative schemes such as rotary position embeddings applied inside attention instead of a learned absolute table, and larger BPE-style vocabularies than GPT-2's. Always load the tokenizer shipped with the weights you use; vocabularies are not interchangeable.

## Workflow

1. Pick the tokenizer that matches the target model; never mix tokenizers and weights.
2. Clean and concatenate documents, separated by the end-of-text token.
3. Tokenize once; record total token count.
4. Choose `max_length` (at most the model's context length) and `stride` (default equal to `max_length`).
5. Build the dataset of shifted windows and loaders: shuffled train, unshuffled validation, `drop_last` on train.
6. Embed tokens and positions; assert shapes `(batch, seq, emb_dim)`.

## Red flags

- Targets equal to inputs (no shift), or shifted the wrong way.
- A word-level vocabulary built from the training set used on new text.
- Windows longer than the model's supported context length; `pos_emb` indexed past its size.
- Documents concatenated without a separator; special tokens accepted from raw user input.
- Validation loader shuffled or sharing windows with training (leakage through overlapping strides).
- Tokenizer from one model family paired with weights from another.

## Testing notes

- tdd: round trip `decode(encode(text)) == text` on ASCII, Unicode, code and whitespace-heavy samples.
- Assert `targets[:, :-1] == inputs[:, 1:]` for every batch; this catches shift bugs immediately.
- Hand-compute the number of windows for a tiny token list with given `max_length` and `stride`, then assert `len(dataset)`.
- Shape tests for embeddings; check that the same token ID at two positions yields different input vectors only after positions are added.
- Fix `torch.manual_seed` and use `shuffle=False` in tests so batches are deterministic.

## Related

- `../IntroductionToPyTorch/introductionToPyTorch.md` — Dataset, DataLoader and tensors.
- `../../Architecture/AttentionMechanisms/attentionMechanisms.md` — what consumes these embeddings.
- `../../Training/Pretraining/pretraining.md` — train/validation split and loss on these batches.
- `../../FineTuning/InstructionFineTuning/instructionFineTuning.md` — padding and masking variable-length examples.
- `../../../HandsOnLLM/UnderstandingLanguageModels/TokensAndEmbeddings/tokensAndEmbeddings.md` — comparing real tokenizers and embedding models.
- `../../../DesigningMLSystems/Data/TrainingData/trainingData.md` — sampling and splitting training data.
