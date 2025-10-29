import tempfile
from pathlib import Path

from main.env_validator import EnvValidator


class TestEnvValidator:
    def setup_env(self, files, tmpdir):
        file_paths = {}
        for fname, lines in files.items():
            path = Path(tmpdir) / fname
            with Path.open(path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            file_paths[fname] = path
        return file_paths

    def test_warn_if_setting_in_example_not_base(self):
        files = {
            "backend.env": ["BASE=1"],
            "backend.local.env": ["BASE=1", "EXTRA=foo"],
            "backend.local.example.env": ["EXTRA=bar"],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            file_paths = self.setup_env(files, tmpdir)
            validator = EnvValidator(
                base_env_path=file_paths["backend.env"],
                local_env_path=file_paths["backend.local.env"],
                example_env_path=file_paths["backend.local.example.env"],
            )
            warnings = validator.validate_all()
            assert any(
                "EXTRA" in w and "not defined in backend.env" in w for w in warnings
            )

    def test_suppress_warning_with_local_required(self):
        files = {
            "backend.env": ["BASE=1"],
            "backend.local.env": ["BASE=1", "EXTRA=foo"],
            "backend.local.example.env": ["EXTRA=bar # local-required"],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            file_paths = self.setup_env(files, tmpdir)
            validator = EnvValidator(
                base_env_path=file_paths["backend.env"],
                local_env_path=file_paths["backend.local.env"],
                example_env_path=file_paths["backend.local.example.env"],
            )
            warnings = validator.validate_all()
            assert not any(
                "EXTRA" in w and "not defined in backend.env" in w for w in warnings
            )

    def test_warn_if_local_overrides_base(self):
        files = {
            "backend.env": ["BASE=1"],
            "backend.local.env": ["BASE=2"],
            "backend.local.example.env": ["BASE=1"],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            file_paths = self.setup_env(files, tmpdir)
            validator = EnvValidator(
                base_env_path=file_paths["backend.env"],
                local_env_path=file_paths["backend.local.env"],
                example_env_path=file_paths["backend.local.example.env"],
            )
            warnings = validator.validate_all()
            assert any("BASE" in w and "overridden locally" in w for w in warnings)

    def test_warn_if_example_not_in_local(self):
        files = {
            "backend.env": ["BASE=1"],
            "backend.local.env": ["BASE=1"],
            "backend.local.example.env": ["BASE=1", "EXTRA=bar"],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            file_paths = self.setup_env(files, tmpdir)
            validator = EnvValidator(
                base_env_path=file_paths["backend.env"],
                local_env_path=file_paths["backend.local.env"],
                example_env_path=file_paths["backend.local.example.env"],
            )
            warnings = validator.validate_all()
            assert any(
                "EXTRA" in w and "missing a required local-specific setting" in w
                for w in warnings
            )
