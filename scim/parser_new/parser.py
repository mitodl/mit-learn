import pyparsing as pp


NameChar = pp.Word(pp.alphanums + "_-")

AttrName = pp.Word(pp.alphas, NameChar)
SubAttr = pp.Word(".", AttrName)

AttrPath = pp.Combine(AttrName, pp.Opt(SubAttr))

ComparisonOperator = pp.one_of(
    ["eq", "ne", "co", "sw", "ew", "gt", "lt", "ge", "le"], caseless=True, keyword=True
)

ValueTrue = pp.Literal("true")
ValueFalse = pp.Literal("false")
ValueNull = pp.Literal("null")
ValueNumber = pp.common.number
ValueString = pp.dbl_quoted_string

ComparisonValue = ValueTrue | ValueFalse | ValueNull | ValueNumber | ValueString

LogicalOperator = pp.one_of(["or", "and"], caseless=True, keyword=True)

NegationOperator = pp.CaselessLiteral("not")

AttrExpression = pp.Group(AttrPath + pp.Literal("pr")) ^ pp.Group(
    AttrPath + ComparisonOperator + ComparisonValue
)

Filter = pp.Forward()

LeftPrecedence, RightPrecedence = map(pp.Literal, "()")
LeftFilterGrouping, RightFilterGrouping = map(pp.Literal, "[]")

LogicalExpression = Filter + LogicalOperator + Filter

ValueFilter = pp.Forward()
ValueFilter <<= (
    AttrExpression
    ^ LogicalExpression
    ^ pp.Group(
        pp.Opt(NegationOperator) + LeftPrecedence + ValueFilter + RightPrecedence
    )
)

ValuePath = AttrPath + LeftFilterGrouping + ValueFilter + RightFilterGrouping

Filter <<= (
    AttrExpression
    ^ LogicalExpression
    ^ ValuePath
    ^ pp.Group(pp.Opt(NegationOperator) + LeftPrecedence + Filter + RightPrecedence)
)
