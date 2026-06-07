from deployments.tofu import build_tofu_config
from orqestra.tests import BaseTestCase


class PlanTests(BaseTestCase):
    def test_plan_valid_diagram(self):
        payload = {
            "diagram": {
                "nodes": [self._make_valid_lambda_node()],
                "edges": [],
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(len(response.data["resources"]), 1)
        self.assertEqual(response.data["resources"][0]["name"], "my-func")

    def test_plan_invalid_missing_function_name(self):
        node = self._make_valid_lambda_node()
        node["data"]["config"]["function_name"] = ""
        payload = {
            "diagram": {
                "nodes": [node],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
        self.assertTrue(len(response.data["errors"]) > 0)

    def test_plan_counts_connections(self):
        payload = {
            "diagram": {
                "nodes": [
                    self._make_valid_lambda_node("n1", "func-a"),
                    self._make_valid_lambda_node("n2", "func-b"),
                ],
                "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        resources = response.data["resources"]
        self.assertEqual(resources[0]["connection_count"], 1)
        self.assertEqual(resources[1]["connection_count"], 1)

    def test_plan_get_not_allowed(self):
        response = self.client.get("/plan")
        self.assertEqual(response.status_code, 405)

    def test_plan_invalid_memory_size(self):
        node = self._make_valid_lambda_node()
        node["data"]["config"]["memory_size"] = 64  # Below minimum 128
        payload = {
            "diagram": {
                "nodes": [node],
                "edges": [],
                "deployment_settings": {"region": "", "execution_role_arn": ""},
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])

    def _make_vpc_node(self, node_id="vpc-1", cidr="10.0.0.0/16"):
        return {
            "id": node_id,
            "type": "vpc",
            "data": {
                "service_id": "vpc",
                "label": "VPC",
                "config": {
                    "vpc_name": "my-vpc",
                    "cidr_block": cidr,
                    "enable_dns_hostnames": True,
                    "enable_dns_support": True,
                },
            },
        }

    def _make_subnet_node(
        self, node_id="subnet-1", cidr="10.0.1.0/24", subnet_type="private"
    ):
        return {
            "id": node_id,
            "type": "subnet",
            "data": {
                "service_id": "subnet",
                "label": "Subnet",
                "config": {
                    "subnet_name": "my-subnet",
                    "cidr_block": cidr,
                    "subnet_type": subnet_type,
                    "availability_zone": "us-east-1a",
                    "map_public_ip_on_launch": False,
                },
            },
        }

    def _make_sg_node(self, node_id="sg-1", group_name="my-sg"):
        return {
            "id": node_id,
            "type": "security-group",
            "data": {
                "service_id": "security-group",
                "label": "Security Group",
                "config": {
                    "group_name": group_name,
                    "description": "Lambda SG",
                    "ingress_rules": [],
                    "egress_rules": [],
                },
            },
        }

    def _make_iam_role_node(self, node_id="role-1", role_name="my-role"):
        return {
            "id": node_id,
            "type": "iam-role",
            "data": {
                "service_id": "iam-role",
                "label": "IAM Role",
                "config": {
                    "role_name": role_name,
                    "assume_role_policy_document": '{"Version": "2012-10-17", "Statement": []}',
                },
            },
        }

    def _make_ecr_node(self, node_id="ecr-1", repo_name="my-repo"):
        return {
            "id": node_id,
            "type": "ecr",
            "data": {
                "service_id": "ecr",
                "label": "ECR Repository",
                "config": {"repository_name": repo_name},
            },
        }

    def _make_efs_node(self, node_id="efs-1", token="my-efs"):
        return {
            "id": node_id,
            "type": "efs",
            "data": {
                "service_id": "efs",
                "label": "EFS",
                "config": {
                    "creation_token": token,
                    "performance_mode": "generalPurpose",
                    "throughput_mode": "bursting",
                    "access_points": [{"path": "/lambda"}],
                },
            },
        }

    def _make_layer_node(self, node_id="layer-1", layer_name="my-layer"):
        return {
            "id": node_id,
            "type": "lambda-layer",
            "data": {
                "service_id": "lambda-layer",
                "label": "Layer",
                "config": {
                    "layer_name": layer_name,
                    "compatible_runtimes": ["nodejs20.x"],
                    "compatible_architectures": ["x86_64"],
                },
            },
        }

    def test_plan_lambda_complex_relationships_zip(self):
        lambda_node = self._make_valid_lambda_node("lambda-1", "my-zip-func")
        lambda_node["data"]["service_id"] = "lambda"
        lambda_node["data"]["config"].update(
            {
                "package_type": "Zip",
                "enable_function_url": True,
                "function_url_auth_type": "NONE",
                "log_retention": 7,
                "snap_start": "PublishedVersions",
                "tracing_mode": "Active",
                "ephemeral_storage": 1024,
            }
        )

        vpc = self._make_vpc_node("vpc-1")
        subnet = self._make_subnet_node("subnet-1", subnet_type="private")
        sg = self._make_sg_node("sg-1")
        role = self._make_iam_role_node("role-1")
        efs = self._make_efs_node("efs-1")
        layer = self._make_layer_node("layer-1")

        nodes = [lambda_node, vpc, subnet, sg, role, efs, layer]
        edges = [
            {"id": "e1", "source": "subnet-1", "target": "vpc-1"},
            {"id": "e2", "source": "sg-1", "target": "vpc-1"},
            {"id": "e3", "source": "lambda-1", "target": "subnet-1"},
            {"id": "e4", "source": "lambda-1", "target": "sg-1"},
            {"id": "e5", "source": "lambda-1", "target": "role-1"},
            {"id": "e6", "source": "lambda-1", "target": "efs-1"},
            {"id": "e7", "source": "lambda-1", "target": "layer-1"},
            {
                "id": "e8",
                "source": "efs-1",
                "target": "subnet-1",
            },  # Connect EFS to subnet for mounts
        ]

        # Test plan validation endpoint
        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": edges,
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        # Test Tofu generation
        tofu_config = build_tofu_config(nodes, edges, {"region": "us-east-1"})
        resources = tofu_config["resource"]

        self.assertIn("aws_lambda_function", resources)
        self.assertIn("lambda_1", resources["aws_lambda_function"])
        lf = resources["aws_lambda_function"]["lambda_1"]

        self.assertEqual(lf["function_name"], "my-zip-func")
        self.assertEqual(lf["role"], "${aws_iam_role.role_1.arn}")
        self.assertEqual(lf["runtime"], "nodejs20.x")
        self.assertEqual(lf["handler"], "index.handler")
        self.assertEqual(lf["filename"], "bundles/lambda_1.zip")
        self.assertEqual(lf["ephemeral_storage"], {"size": 1024})
        self.assertEqual(lf["snap_start"], {"apply_on": "PublishedVersions"})
        self.assertEqual(lf["tracing_config"], {"mode": "Active"})

        # VPC configuration assertion
        self.assertIn("vpc_config", lf)
        self.assertEqual(lf["vpc_config"]["subnet_ids"], ["${aws_subnet.subnet_1.id}"])
        self.assertEqual(
            lf["vpc_config"]["security_group_ids"], ["${aws_security_group.sg_1.id}"]
        )

        # Layers assertion
        self.assertIn("layers", lf)
        self.assertEqual(lf["layers"], ["${aws_lambda_layer_version.layer_1.arn}"])

        # EFS File System Config assertion
        self.assertIn("file_system_config", lf)
        self.assertEqual(
            lf["file_system_config"]["arn"], "${aws_efs_access_point.efs_1_ap_0.arn}"
        )
        self.assertEqual(lf["file_system_config"]["local_mount_path"], "/mnt/efs")

        # Function URL assertion
        self.assertIn("aws_lambda_function_url", resources)
        self.assertIn("lambda_1_url", resources["aws_lambda_function_url"])
        self.assertEqual(
            resources["aws_lambda_function_url"]["lambda_1_url"]["authorization_type"],
            "NONE",
        )

        # Log group assertion
        self.assertIn("aws_cloudwatch_log_group", resources)
        self.assertIn("lambda_log_lambda_1", resources["aws_cloudwatch_log_group"])
        self.assertEqual(
            resources["aws_cloudwatch_log_group"]["lambda_log_lambda_1"][
                "retention_in_days"
            ],
            7,
        )

    def test_plan_lambda_complex_relationships_image(self):
        lambda_node = self._make_valid_lambda_node("lambda-1", "my-img-func")
        lambda_node["data"]["service_id"] = "lambda"
        lambda_node["data"]["config"].update(
            {"package_type": "Image", "image_tag": "v1.0.0"}
        )

        ecr = self._make_ecr_node("ecr-1")

        nodes = [lambda_node, ecr]
        edges = [{"id": "e1", "source": "lambda-1", "target": "ecr-1"}]

        # Test plan validation endpoint
        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": edges,
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        # Test Tofu generation
        tofu_config = build_tofu_config(nodes, edges, {"region": "us-east-1"})
        resources = tofu_config["resource"]

        self.assertIn("aws_lambda_function", resources)
        self.assertIn("lambda_1", resources["aws_lambda_function"])
        lf = resources["aws_lambda_function"]["lambda_1"]

        self.assertEqual(lf["function_name"], "my-img-func")
        self.assertEqual(lf["package_type"], "Image")
        self.assertEqual(
            lf["image_uri"], "${aws_ecr_repository.ecr_1.repository_url}:v1.0.0"
        )

    def test_plan_lambda_warnings_and_errors(self):
        # 1. Public subnet warning
        lambda_node = self._make_valid_lambda_node("lambda-1", "my-func")
        lambda_node["data"]["service_id"] = "lambda"
        vpc = self._make_vpc_node("vpc-1")
        subnet = self._make_subnet_node("subnet-1", subnet_type="public")
        subnet["data"]["label"] = "My Public Subnet"
        sg = self._make_sg_node("sg-1")

        nodes = [lambda_node, vpc, subnet, sg]
        edges = [
            {"id": "e1", "source": "subnet-1", "target": "vpc-1"},
            {"id": "e2", "source": "sg-1", "target": "vpc-1"},
            {"id": "e3", "source": "lambda-1", "target": "subnet-1"},
            {"id": "e4", "source": "lambda-1", "target": "sg-1"},
        ]

        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": edges,
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        # Warnings are returned as validation errors in this endpoint, so valid is False and status is 422.
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
        self.assertTrue(
            any(
                "WARNING" in err and "public subnet" in err
                for err in response.data["errors"]
            )
        )

        # 2. EFS without VPC config error
        efs = self._make_efs_node("efs-1")
        nodes_no_vpc = [lambda_node, efs]
        edges_no_vpc = [{"id": "e1", "source": "lambda-1", "target": "efs-1"}]
        payload = {
            "diagram": {
                "nodes": nodes_no_vpc,
                "edges": edges_no_vpc,
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
        self.assertTrue(
            any(
                "lacks VPC subnet or security group connections" in err
                for err in response.data["errors"]
            )
        )

    def test_plan_lambda_visual_nested_containment(self):
        # Setup Lambda visually inside a Subnet which is visually inside a VPC
        lambda_node = self._make_valid_lambda_node("lambda-1", "my-nested-func")
        lambda_node["data"]["service_id"] = "lambda"
        lambda_node["parentNode"] = "subnet-1"  # visual nesting

        subnet = self._make_subnet_node("subnet-1", subnet_type="private")
        subnet["parentNode"] = "vpc-1"  # visual nesting

        vpc = self._make_vpc_node("vpc-1")
        sg = self._make_sg_node("sg-1")
        role = self._make_iam_role_node("role-1")

        nodes = [lambda_node, subnet, vpc, sg, role]
        # Edges do not contain containment relations (only IAM role and Security Group)
        edges = [
            {"id": "e1", "source": "lambda-1", "target": "role-1"},
            {"id": "e2", "source": "lambda-1", "target": "sg-1"},
        ]

        # 1. Test validation on server
        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": edges,
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])

        # 2. Test OpenTofu generation resolves subnet and VPC correctly from visual nesting
        tofu_config = build_tofu_config(nodes, edges, {"region": "us-east-1"})
        resources = tofu_config["resource"]

        self.assertIn("aws_lambda_function", resources)
        lf = resources["aws_lambda_function"]["lambda_1"]
        self.assertEqual(lf["vpc_config"]["subnet_ids"], ["${aws_subnet.subnet_1.id}"])

    def test_plan_new_container_services_success(self):
        nodes = [
            {
                "id": "reg-1",
                "type": "region",
                "data": {
                    "service_id": "region",
                    "label": "Region",
                    "config": {"region_name": "us-east-1"},
                },
            },
            {
                "id": "az-1",
                "type": "availability-zone",
                "data": {
                    "service_id": "availability-zone",
                    "label": "AZ",
                    "config": {"zone_name": "us-east-1a"},
                },
            },
            {
                "id": "env-1",
                "type": "environment",
                "data": {
                    "service_id": "environment",
                    "label": "Env",
                    "config": {"env_name": "production"},
                },
            },
            {
                "id": "grp-1",
                "type": "app-group",
                "data": {
                    "service_id": "app-group",
                    "label": "Group",
                    "config": {"group_name": "backend-services"},
                },
            },
            {
                "id": "tb-1",
                "type": "trust-boundary",
                "data": {
                    "service_id": "trust-boundary",
                    "label": "Boundary",
                    "config": {"boundary_name": "pci-boundary"},
                },
            },
            {
                "id": "ss-1",
                "type": "shared-services",
                "data": {
                    "service_id": "shared-services",
                    "label": "Shared",
                    "config": {"services_name": "logging-service"},
                },
            },
            {
                "id": "acc-1",
                "type": "account",
                "data": {
                    "service_id": "account",
                    "label": "Account",
                    "config": {"account_id": "123456789012"},
                },
            },
        ]
        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": [],
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(len(response.data["resources"]), 7)

    def test_plan_new_container_services_invalid(self):
        nodes = [
            {
                "id": "reg-1",
                "type": "region",
                "data": {
                    "service_id": "region",
                    "label": "Region",
                    "config": {"region_name": ""},
                },
            },
            {
                "id": "az-1",
                "type": "availability-zone",
                "data": {
                    "service_id": "availability-zone",
                    "label": "AZ",
                    "config": {"zone_name": ""},
                },
            },
            {
                "id": "env-1",
                "type": "environment",
                "data": {"service_id": "environment", "label": "Env", "config": {}},
            },
            {
                "id": "grp-1",
                "type": "app-group",
                "data": {"service_id": "app-group", "label": "Group", "config": {}},
            },
            {
                "id": "tb-1",
                "type": "trust-boundary",
                "data": {
                    "service_id": "trust-boundary",
                    "label": "Boundary",
                    "config": {},
                },
            },
            {
                "id": "ss-1",
                "type": "shared-services",
                "data": {
                    "service_id": "shared-services",
                    "label": "Shared",
                    "config": {},
                },
            },
            {
                "id": "acc-1",
                "type": "account",
                "data": {
                    "service_id": "account",
                    "label": "Account",
                    "config": {"account_id": "invalid-acc"},
                },
            },
        ]
        payload = {
            "diagram": {
                "nodes": nodes,
                "edges": [],
                "deployment_settings": {
                    "region": "us-east-1",
                    "execution_role_arn": "",
                },
                "last_saved_at": "",
            }
        }
        response = self.client.post("/plan", payload, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.data["valid"])
        self.assertEqual(len(response.data["errors"]), 7)
        errors_str = " ".join(response.data["errors"])
        self.assertIn("requires a region name", errors_str)
        self.assertIn("requires a zone name", errors_str)
        self.assertIn("requires an environment name", errors_str)
        self.assertIn("requires a group name", errors_str)
        self.assertIn("requires a boundary name", errors_str)
        self.assertIn("requires a services name", errors_str)
        self.assertIn("must be a 12-digit AWS account ID", errors_str)
