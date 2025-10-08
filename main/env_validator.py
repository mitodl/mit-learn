"""
Environment variable validation utilities for detecting configuration discrepancies.
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def strip_comment(val):
    return val.split("#", 1)[0].strip()


class EnvValidator:
    """Validates environment variable configurations and reports discrepancies."""

    def __init__(self, project_root: Optional[str] = None):
        """
        Initialize the environment validator.

        Args:
            project_root: Root directory of the project.
            If None, defaults to parent of this file's directory.
        """
        if project_root is None:
            project_root = Path(__file__).parent.parent
        else:
            project_root = Path(project_root)

        self.project_root = project_root
        self.env_dir = project_root / "env"

    def _parse_env_file(self, file_path: Path) -> dict[str, dict]:
        """
        Parse an environment file and return a dictionary of key-value pairs
        and any noqa-style directives.

        Args:
            file_path: Path to the environment file

        Returns:
            Dictionary mapping variable names to dicts with 'value'
            and optional 'directive'.
        """
        env_vars = {}

        if not file_path.exists():
            return env_vars

        with Path.open(file_path, encoding="utf-8") as f:
            for original_line in f:
                line = original_line.strip()

                # Skip empty lines and comments
                if not line or line.startswith("#"):
                    continue

                # Check for noqa-style directive at end of line
                directive = None
                if line.endswith("# local-required"):
                    directive = "local-required"
                    line = line[: -len("# local-required")].rstrip()
                elif line.endswith("# suppress-warning"):
                    directive = "suppress-warning"
                    line = line[: -len("# suppress-warning")].rstrip()

                # Parse regular env variables
                if "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()

                    env_vars[key] = {"value": value}
                    if directive:
                        env_vars[key]["directive"] = directive

        return env_vars

    def _get_env_file_pairs(self) -> list[tuple[str, Path, Path, Path]]:
        """
        Get pairs of environment files to compare.

        Returns:
            List of tuples: (env_type, base_env_path, local_env_path, example_env_path)
        """
        pairs = []

        # Define the environment file patterns
        env_patterns = [
            (
                "backend",
                "backend.env",
                "backend.local.env",
                "backend.local.example.env",
            ),
            (
                "frontend",
                "frontend.env",
                "frontend.local.env",
                "frontend.local.example.env",
            ),
            ("shared", "shared.env", "shared.local.env", "shared.local.example.env"),
        ]

        for env_type, base_name, local_name, example_name in env_patterns:
            base_path = self.env_dir / base_name
            local_path = self.env_dir / local_name
            example_path = self.env_dir / example_name

            if base_path.exists() or local_path.exists() or example_path.exists():
                pairs.append((env_type, base_path, local_path, example_path))

        return pairs

    def check_example_overrides(self) -> list[str]:
        """
        Check for settings present in example files but not in base env files.
        This identifies non-standard settings that are overridden in the environment.

        Returns:
            List of warning messages
        """
        warnings = []

        for env_type, base_path, local_path, example_path in self._get_env_file_pairs():
            if not example_path.exists():
                continue

            base_vars = self._parse_env_file(base_path) if base_path.exists() else {}
            example_vars = self._parse_env_file(example_path)

            example_only = set(example_vars.keys()) - set(base_vars.keys())

            for var_name in example_only:
                # Only warn if the variable is present in local file
                if local_path.exists():
                    local_vars = self._parse_env_file(local_path)
                    if var_name in local_vars:
                        example_value = example_vars[var_name]["value"]
                        local_value = local_vars[var_name]["value"]
                        if strip_comment(local_value) == strip_comment(example_value):
                            continue
                        warnings.append(
                            f"⚠️  {env_type.upper()}: Variable "
                            f"'{var_name}' is set in {local_path.name} "
                            f"but not defined in {base_path.name}. "
                            f"This overrides a non-standard setting "
                            f"from {example_path.name}. "
                            f"Local value: '{local_value}', "
                            f"Example value: '{example_value}'"
                        )
        return warnings

    def check_local_overrides(self) -> list[str]:
        """
        Check for settings in local files that differ from or are absent in base files.

        Returns:
            List of warning messages
        """
        warnings = []

        for env_type, base_path, local_path, _ in self._get_env_file_pairs():
            if not local_path.exists():
                continue

            base_vars = self._parse_env_file(base_path) if base_path.exists() else {}
            local_vars = self._parse_env_file(local_path)

            for var_name, local_info in local_vars.items():
                local_value = local_info["value"]
                suppress = local_info.get("directive") == "suppress-warning"
                if var_name not in base_vars:
                    if suppress:
                        continue
                    warnings.append(
                        f"⚠️  {env_type.upper()}: Variable "
                        f"'{var_name}' is set in {local_path.name} "
                        f"(value: '{local_value}') but "
                        f"not defined in {base_path.name}. "
                        f"Consider adding a default value to "
                        f"{base_path.name} if this should be a standard setting."
                    )
                else:
                    base_value = base_vars[var_name]["value"]
                    # Compare values ignoring anything after a "#" symbol
                    if strip_comment(base_value) == strip_comment(local_value):
                        continue  # No warning if values match (ignoring comments)
                    # Suppress warning if base file has # local-required
                    if base_vars[var_name].get("directive") == "local-required":
                        continue
                    warnings.append(
                        f"⚠️  {env_type.upper()}: Variable "
                        f"'{var_name}' is overridden locally. "
                        f"Base value: '{base_value}', "
                        f"Local value: '{local_value}'. "
                        f"Ensure the default in {base_path.name} is appropriate."
                    )
        return warnings

    def validate_all(self) -> list[str]:
        """
        Run all environment validation checks.

        Returns:
            List of all warning messages
        """
        warnings = []
        warnings.extend(self.check_example_overrides())
        warnings.extend(self.check_local_overrides())
        return warnings

    def log_warnings(self, warnings: list[str]) -> None:
        """
        Log warning messages.

        Args:
            warnings: List of warning messages to log
        """
        if not warnings:
            logger.info(
                "✅ Environment validation passed - "
                "no configuration discrepancies found."
            )
            return

        logger.warning("Environment Configuration Warnings:")
        logger.warning("=" * 60)
        for warning in warnings:
            logger.warning(warning)
        logger.warning("=" * 60)
        logger.warning(
            "Found %s environment configuration issue(s). "
            "Review your environment files to ensure proper configuration.",
            len(warnings),
        )


def validate_environment_on_startup():
    """
    Validate environment configuration on startup.
    This can be called from Django settings or management commands.
    """
    validator = EnvValidator()
    warnings = validator.validate_all()
    validator.log_warnings(warnings)
    return warnings
