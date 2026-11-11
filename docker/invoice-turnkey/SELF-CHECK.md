# Turnkey pre-launch self-test: written review

Before production, the MOF reviews a written report for the "Turnkey pre-launch self-test" (`電子發票Turnkey上線前自行檢測作業`). This page covers what a report built on `@rytass/invoice-turnkey-base-nestjs-module` needs to pass that review. The notes come from a real review that was rejected several times before it passed (November 2026). It does not repeat the test steps themselves; the [Docker guide](README.md#25-pre-launch-self-test) covers those.

## 1. Format

Reports with the wrong format are rejected before anyone reads the content.

- Use the template version the reviewer asks for. In November 2026 the reviewer required **Ver 4.8.x**. The public download page still offered 4.7.x, so get the template from the test platform instead.
- Submit the template's cover page through chapter 3. Remove the appendix (`附錄、上傳作業檢測項目`); you fill that part in the online form on the platform, not in the file.
- Do not edit the template text. Keep the original blank pages and wording. Only tick the check boxes and fill the blanks.
- Put the explanation and screenshots for each item in that item's answer cell (`(佐證畫面與說明)`). For steps without an answer cell (for example the environment tables and E0402), put them directly below the table.
- Number every figure and give it a caption: what it shows, the source system, the environment and the date. Refer to figures by number in the text.
- Text-mode Turnkey screens can be shown as rendered text images. Say so in the caption.
- Update the table of contents page numbers after the last edit. The template's numbers are stale once you add content.
- Upload the `.odt`. Keep a PDF of the same content in case the platform asks for it.

## 2. Writing style

- Describe the final state of the system and give the evidence. Leave out the history (earlier attempts, rejected uploads that were fixed later, how a problem was found).
- Keep each item to a few short paragraphs. Reviewers check whether their question is answered, not how much is written.
- Every claim needs a screenshot or a log behind it. A claim that a screenshot contradicts is a reason to reject.
- Screenshots from a test environment are accepted. Crop them to the part that proves the point, and keep them readable at page width.
- Remove anything that identifies other companies (test counterparties' names, tax IDs, e-mail addresses) unless the item needs it.

## 3. Item 1: track check (`字軌檢核`)

The reviewer asks where tracks come from and how the system builds them:

> 請提供字軌取得來源畫面與說明，並說明貴司系統如何建置字軌。若為匯入請提供系統匯入畫面；若為人工手動輸入，須提供多人覆核機制。

If tracks can be typed in by hand, you must document a multi-person review process. The simpler route is to accept tracks only from E0501 assignment files:

1. On the platform, set Turnkey as the receiving method for invoice-number business (`接收方式及授權` → `發票字軌號碼相關業務`).
2. Set `allowManualTrackRegistration: false` in the module options, and remove any manual "add track" screen from the app.
3. Take numbers on the platform. The module imports the E0501 file and records its source (see [Assignment files (E0501)](../../packages/invoice-turnkey-base-nestjs-module/README.md#assignment-files-e0501)).

Order matters:

- Set the receiving method **before** taking numbers. Numbers taken before the setting are never sent as E0501, so the system cannot import them, and it cannot report their unused numbers (E0402) at the end of the period either.
- The platform sends E0501 in hourly batches. A number taken at 16:10 arrives around 17:00, not right away.
- Only one Turnkey may use the transport account. Another Turnkey on the same account downloads the E0501 first.

Evidence that answered this item:

| Figure                                                                                         | Shows                                   |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| Platform track allocation (`電子發票字軌號碼取號`): the request form and the allocation result | Where the numbers come from             |
| Platform receiving-method setting for invoice-number business, with the routing code           | That the platform sends them to Turnkey |
| The E0501 file (key fields) with Turnkey's receive log and the app's import log                | How the system builds the track         |
| The app's track list showing source, file name and received time                               | The imported track                      |
| The app's import history                                                                       | That every file's result is recorded    |
| The issue screen with a read-only invoice number field                                         | That users cannot pick or type a number |

State in one sentence that the system has no manual track entry. If the screenshots still show tracks registered by hand during testing, add one sentence saying they are test data and that production has no such source.

## 4. Item 2: duplicate-number check (`重號檢核`)

The reviewer asks how the system prevents invoices outside the allocated ranges and duplicates across stores, with track exhaustion as the example:

> 請詳述「開立非配號區間」發票(不同店重號) 檢核方式與說明(EX：若字軌用畢，貴司系統會提供的警示畫面與說明)。

Explain the mechanism first, then show exhaustion:

- Numbers come only from imported ranges, in ascending order. Users cannot type or choose a number.
- Allocation runs in a database transaction that locks the period's tracks, and `(companyTaxId, invoiceNumber)` is unique. Concurrent issuers get different numbers.
- State how stores are organised. With a single seller and no branches, all invoices come from one allocator. With branches, explain how each branch's ranges are kept apart.

Exhaustion evidence, all from one test run:

1. The low-track alert. The module emits `invoice-track.running-low` once when the remaining count drops below `notifications.invoiceTrackRunningLowThreshold` (default 50) and once at zero. Show both entries in your alert screen.
2. The track list with zero remaining.
3. The issue screen rejecting a new invoice with `NO_AVAILABLE_NUMBER`.
4. One sentence with the test result: how many invoices were issued, that no number repeated, and that all were inside allocated ranges.

To exhaust tracks in the test zone, issue real test invoices until every track of the period is used. `abandon` cannot be used for this, because it only accepts numbers in `RETURNED` status. Issuing to a test counterparty with small amounts is enough. A period with three 50-number books needs about 150 invoices.

## 5. Other items that drew questions

- **E0402 blank report.** Split ranges at every 50-number booklet; one range across booklets is rejected with E0613. The report is accepted only after the period ends. Show the final successful upload; the caption can mention an earlier rejected row if it appears in the same screen.
- **Missed-upload check (`漏上傳檢核`).** Show the daily `SummaryResult` reconciliation output. If it lists differences, give a one-line resolution for each.
- **Error handling (`發票異常處理檢核`).** Show the alert screen with at least one real alert, for example a submission with no result after the stall timeout.
- **Platform screens.** Registration, master certificate, software certificate and receiving method are checked on both the production and the test platform. Capture each one on both.

## 6. Before you submit

- [ ] The template version matches the reviewer's request; cover through chapter 3, no appendix.
- [ ] Every check box is ticked, including "not a value-added center" and "single organisation" where they apply.
- [ ] Each item's answer cell has the explanation and figures, and every figure is referred to in the text.
- [ ] Number ranges, dates and figure numbers agree between the text, the captions and the screenshots.
- [ ] Table of contents page numbers match the final file.
- [ ] Have someone who did not write the report read it against the reviewer's comments before it goes out.
