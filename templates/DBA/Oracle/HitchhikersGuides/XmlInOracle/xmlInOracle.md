---
name: dba-xml-in-oracle
description: "How to work with XML in Oracle: well-formed vs valid documents, DTD and XML Schema basics, generating XML from queries and applying XML to tables with the XML-SQL Utility (DBMS_XMLQuery, DBMS_XMLSave, Java OracleXMLQuery), and storing and querying XMLType columns, based on Chapter 52 (The Hitchhiker's Guide to XML in Oracle) of Oracle Database 11g: The Complete Reference. Use when the user needs to export table rows as XML, load or update tables from XML documents, design a DTD or XSD for data interchange, create an XMLType column, query it with XPath (extract, existsNode, getClobVal), or index XML content."
---

# The Hitchhiker's Guide to XML in Oracle

XML describes what data means, which makes it a good interchange format between unlike systems. Validate structure at the boundary (DTD or, better, XML Schema), turn rows into XML and back with Oracle's built-in packages rather than hand-built string concatenation, and store documents you need to query as `XMLType`.

## Documents: well-formed and valid

- Elements wrap content; attributes sit in the start tag in double quotes. Names are case sensitive. Empty element: `<note/>`.
- Each element has one parent; children must close before their parent. Avoid elements that mix text content with child elements in interchange formats.
- Use attributes for identifiers and small qualifiers, element content for the bulk of the data.
- **Well-formed** means: matching start and end tags, no overlap, one root, quoted attribute values, no duplicate attribute names, no comments or processing instructions inside tags, no unescaped `<` or `&` in data.
- **Valid** means well-formed and conforming to its DTD or schema.

## DTDs

A DTD declares which elements may appear, their order and their attributes; a document references one DTD with `<!DOCTYPE root SYSTEM "file.dtd">`.

```xml
<!ELEMENT OrderList (Order*)>
<!ELEMENT Order (OrderId, Customer, Line+, Note?)>
<!ATTLIST Order priority CDATA #IMPLIED>
<!ELEMENT OrderId (#PCDATA)>
<!ELEMENT Line ((ProductId, Qty) | ServiceCode)>
```

- `*` zero or more, `+` one or more, `?` zero or one; commas mean sequence, `|` means choice; `#PCDATA` is parsed text.
- Look for an existing industry DTD or schema before writing your own.

## XML Schema

Prefer XML Schema for database work: it has data types, reusable named types, derived types and multiple schemas per document.

```xml
<xsd:complexType name="Address">
  <xsd:sequence>
    <xsd:element name="Street" type="xsd:string"/>
    <xsd:element name="City"   type="xsd:string"/>
    <xsd:element name="Zip"    type="xsd:string" minOccurs="0"/>
  </xsd:sequence>
</xsd:complexType>
<xsd:element name="shipTo" type="Address"/>
<xsd:element name="discount" type="xsd:decimal" nillable="true"/>
```

- Elements: `xsd:element` with `type`, `minOccurs`, `maxOccurs`; `nillable="true"` allows NULL.
- Attributes: `xsd:attribute` with `use="required|optional"` and `default`.
- Reuse: named `complexType`, anonymous types for one-off elements, model groups (`xsd:group`, top level) and `xsd:attributeGroup`.
- Integrity inside a document: `xsd:unique`, and `xsd:key` / `xsd:keyref` for references between elements, each using `xsd:selector` and `xsd:field` XPaths.

## Generating XML from queries (XSU)

The XML-SQL Utility is Java inside the database with a PL/SQL wrapper. `DBMS_XMLQuery` turns a query into a `ROWSET`/`ROW` document returned as a CLOB.

```sql
create or replace function query_to_xml(p_sql in varchar2) return clob is
  ctx    dbms_xmlquery.ctxType;
  result clob;
begin
  ctx    := dbms_xmlquery.newContext(p_sql);
  result := dbms_xmlquery.getXML(ctx);
  dbms_xmlquery.closeContext(ctx);   -- always release the context
  return result;
end;
/
set long 20000 pagesize 100
select query_to_xml('select product_id, name from products') from dual;
```

- `set long` controls how much CLOB SQL*Plus displays (default 80 characters).
- Pass only trusted, fixed query text; never concatenate user input into `p_sql`.
- From Java, use `oracle.xml.sql.query.OracleXMLQuery(conn, sql).getXMLString()` over a normal JDBC connection, and call `close()`.

## Inserting, updating and deleting from XML

`DBMS_XMLSave` parses a `ROWSET` document and runs DML against a table or view. Missing elements become NULL. Java equivalent: `oracle.xml.sql.dml.OracleXMLSave`.

```sql
create or replace procedure apply_product_xml(p_doc in clob) is
  ctx  dbms_xmlsave.ctxType;
  rows number;
begin
  ctx := dbms_xmlsave.newContext('PRODUCTS');     -- target table
  dbms_xmlsave.clearUpdateColumnList(ctx);
  dbms_xmlsave.setKeyColumn(ctx, 'PRODUCT_ID');   -- where-clause key
  rows := dbms_xmlsave.updateXML(ctx, p_doc);     -- or insertXML / deleteXML
  dbms_xmlsave.closeContext(ctx);
end;
/
```

- `insertXML` needs no key; `updateXML` and `deleteXML` need `setKeyColumn`, or every row could match.
- These calls change data in bulk from external input. Validate the document first, run in a transaction, check the returned row count before committing, and confirm the environment.

## XMLType columns

Store documents you query in an `XMLType` column; it has member functions for XPath access. In this chapter's 11g description the data is stored internally as a CLOB.

```sql
create table order_docs (order_id number primary key, doc xmltype);

insert into order_docs values (:id, xmltype(:xml_text));

select o.doc.extract('/Order/Customer/Name/text()').getStringVal() as customer
  from order_docs o
 where o.doc.existsNode('/Order[@priority="high"]') = 1;
```

- Useful methods: `createXML`, `extract`, `existsNode`, `isFragment`, `getClobVal`, `getStringVal`, `getNumberVal`. See them with `set describe depth 5` and `desc` on the table.
- Function-based indexes on extracted values speed up frequent predicates. With Oracle Text installed, a `ctxsys.context` index on the column supports content search.
- SQL functions on XMLType: `EXTRACT`, `EXTRACTVALUE`, `UPDATEXML`, `XMLELEMENT`, `XMLAGG`, `XMLCONCAT`, `SYS_XMLGEN`, `SYS_XMLAGG`.
- Other packages: `DBMS_XMLGEN`, `DBMS_XMLSTORE`, `DBMS_XMLDOM`, `DBMS_XMLPARSER`, `DBMS_XMLSCHEMA`, `DBMS_XMLINDEX`. Command-line tools: `oraxml` (parse) and `oraxsl` (apply a stylesheet).

## Workflow

1. Agree the interchange contract: reuse a standard schema if one exists; otherwise write an XSD with types and keys.
2. Validate incoming documents against it before touching tables.
3. Export with `DBMS_XMLQuery` (or the Java class) from a fixed query; close every context.
4. Import with `DBMS_XMLSave`, setting the key column for updates and deletes; check row counts before commit.
5. Store queryable documents as `XMLType`; index the paths you filter on.
6. Verify with `getClobVal()` round trips and by comparing row counts with the source document.

## Red flags

- Building XML by string concatenation (unescaped `&` and `<` break well-formedness).
- Treating well-formed as valid; skipping schema validation at the boundary.
- Elements with mixed text and child content in interchange formats.
- `updateXML`/`deleteXML` without `setKeyColumn`.
- Contexts not closed, leaking resources.
- Dynamic SQL text built from user input passed to `newContext`.
- Large documents filtered by XPath with no supporting index.

## Related

- `../../ObjectRelational/LargeObjects/largeObjects.md` — CLOB handling for XML output.
- `../../ObjectRelational/ObjectTypes/objectTypes.md` — object types, the relational counterpart of complex types.
- `../../BeyondTheBasics/OracleText/oracleText.md` — context indexes on XML content.
- `../../JavaInOracle/JdbcProgramming/jdbcProgramming.md` — connections for the Java XSU classes.
- `../../PlSql/DynamicSql/dynamicSql.md` — safe handling of query text.
- `../../../../CleanCode/Boundaries/boundaries.md` — validating data at system boundaries.

Version note: in 11g Release 2 and later, Oracle deprecates `DBMS_XMLQuery`/`DBMS_XMLSave` in favor of `DBMS_XMLGEN`/`DBMS_XMLSTORE`, and `EXTRACT`/`EXTRACTVALUE` in favor of `XMLQUERY`, `XMLTABLE` and `XMLCAST`.
