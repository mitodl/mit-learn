from pyparsing import (
    Regex,
    Forward,
    Suppress,
    Char,
    one_of,
    CaselessLiteral,
    Combine,
    Literal,
    alphas,
    alphanums,
    common,
    dbl_quoted_string,
    remove_quotes,
    Group,
    DelimitedList,
)

UrnAttr = Regex(
    r"(?P<urn>urn:[a-z0-9][a-z0-9-]{0,31}(:[a-z0-9()+,\-.=@;$_!*'%/?#])+):(?P<attr_name>[a-zA-Z_-]+)"
)

NameChar = Char(alphanums + "_-")
AttrName = Combine(Char(alphas) + NameChar[...]).set_results_name("attr_name")
SubAttr = Combine(Literal(".") + AttrName).set_results_name("sub_attr")

AttrPath = Combine((UrnAttr | AttrName.set_results_name("attr_name")) + SubAttr[..., 1])

ComparisonOperator = one_of(
    ["eq", "ne", "co", "sw", "ew", "gt", "lt", "ge", "le"],
    caseless=True,
    as_keyword=True,
).set_results_name("comparison_operator")
LogicalOperator = one_of(
    ["or", "and"], caseless=True, as_keyword=True
).set_results_name("logical_operator")
NegationOperator = CaselessLiteral("not").set_results_name("negation")

ValueTrue = Literal("true").set_parse_action(lambda: True)
ValueFalse = Literal("false").set_parse_action(lambda: False)
ValueNull = Literal("null").set_parse_action(lambda: None)
ValueNumber = common.integer | common.fnumber
ValueString = dbl_quoted_string.set_parse_action(remove_quotes)

ComparisonValue = (
    ValueTrue | ValueFalse | ValueNull | ValueNumber | ValueString
).set_results_name("value")

FilterTerm = Forward()
FilterTermList = Forward()

AttrPresence = Group(AttrPath + "pr").set_results_name("presence")
AttrExpression =  AttrPresence | Group(
    AttrPath + ComparisonOperator + ComparisonValue
)

ValueFilter = Forward()

ValuePath = Group(
    AttrPath + Suppress("[") + ValueFilter("value_filter") + Suppress("]")
).set_results_name("value_path")

ValueFilter <<= (
    AttrExpression
    | FilterTermList
    | Group(NegationOperator[..., 1] + Suppress("(") + ValueFilter + Suppress(")"))
)

FilterTerm <<= (
    AttrExpression
    | ValuePath
    | Group(NegationOperator[..., 1] + Suppress("(") + FilterTerm + Suppress(")"))
)

FilterTermList = DelimitedList(
    FilterTerm,
    LogicalOperator,
)
