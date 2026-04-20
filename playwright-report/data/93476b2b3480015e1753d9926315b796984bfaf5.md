# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-features.spec.ts >> Phase 3 Features >> QR Scanner button on Mentor dashboard
- Location: tests/e2e/phase3-features.spec.ts:38:7

# Error details

```
Error: page.evaluate: FirebaseError: Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.).
    at createErrorInternal (webpack-internal:///(app-pages-browser)/../../node_modules/@firebase/auth/dist/esm2017/index-35c79a8a.js:622:41)
    at _fail (webpack-internal:///(app-pages-browser)/../../node_modules/@firebase/auth/dist/esm2017/index-35c79a8a.js:590:11)
    at _performFetchWithErrorHandling (webpack-internal:///(app-pages-browser)/../../node_modules/@firebase/auth/dist/esm2017/index-35c79a8a.js:1077:17)
    at async _performSignInRequest (webpack-internal:///(app-pages-browser)/../../node_modules/@firebase/auth/dist/esm2017/index-35c79a8a.js:1092:28)
    at async signInWithCustomToken (webpack-internal:///(app-pages-browser)/../../node_modules/@firebase/auth/dist/esm2017/index-35c79a8a.js:6054:22)
    at async eval (eval at evaluate (:302:30), <anonymous>:3:5)
    at async <anonymous>:328:30
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - generic [ref=e6]:
      - img [ref=e9]
      - blockquote [ref=e11]:
        - text: "\"Méně byrokracie,"
        - text: více praxe."
      - paragraph [ref=e12]: PraxiHub zjednodušuje správu stáží pro studenty, firmy i univerzity.
    - generic [ref=e16]:
      - generic [ref=e17]:
        - link "PraxiHub" [ref=e18] [cursor=pointer]:
          - /url: /
          - img [ref=e20]
          - generic [ref=e22]: PraxiHub
        - heading "Přihlášení bez hesla" [level=2] [ref=e23]
        - paragraph [ref=e24]: Zadejte svůj e-mail a my vám pošleme odkaz pro přihlášení (Magic Link).
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]: E-mail nebo Univerzitní ID
          - textbox "E-mail nebo Univerzitní ID" [ref=e28]:
            - /placeholder: jmeno@priklad.cz nebo 123456
        - button "Odeslat přihlašovací odkaz" [ref=e29] [cursor=pointer]
  - button "Potřebujete poradit?" [ref=e31] [cursor=pointer]:
    - generic: Potřebujete poradit?
    - img [ref=e32]
```