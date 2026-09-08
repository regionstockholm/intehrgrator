Three MHV1 example instances are in `examples/Obstetrix-MHV1/source-instance/`. Each file is a one-element JSON array so it matches the schema’s root type (an export of MHV1 rows). Fields follow the Obstetrix form (Del 1–3 plus previous pregnancies); AUDIT answers are not in the schema, so they are only mentioned in notes.

**1-primigravida-basprogram.json** — First pregnancy, MVC Södermalm. Regular cycle, lives with the father, full-time work, no smoking, no prior pregnancies or medication, **Basprogram**.

**2-ivf-multipara.json** — IVF after three years of infertility, MVC Liljeholmen. Previous miscarriage (2019) and live birth (2021). Hypothyroidism + asthma, former smoker who quit at a positive test, ultrasound EDD transferred, **MHV3**.

**3-komplex-mhv3.json** — Single, housing problems, MVC Gottsunda. IUD removed, irregular menses, ongoing tobacco/snus, previous C-section with transfusion, depression on sertraline, correction log row, **MHV3**.

Integer codes are paired with the `*_Text` fields (for example tobacco 1/2/3 = Nej / 1–9 cig / ≥10 cig; pregnancy type 2/3/5 = miscarriage / induced abortion / live birth). All required properties are present.

The schema marks `Personnummer` and previous-pregnancy `Ar` as `format: "time"`, which looks like a generation error. The instances use realistic Swedish identity numbers and years (`19930614-2384`, `2019`) rather than clock times, so a strict format check will flag those two fields.